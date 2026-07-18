import { BskyAgent, RichText } from '@atproto/api';
import { buildAuthorization, getUserRecentAchievements } from '@retroachievements/api';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';

dotenv.config();

const { RA_USERNAME, RA_API_KEY, BSKY_HANDLE, BSKY_PASSWORD } = process.env;

if (!RA_USERNAME || !RA_API_KEY || !BSKY_HANDLE || !BSKY_PASSWORD) {
  process.exit(1);
}

const HISTORY_FILE = path.join(process.cwd(), 'posted.json');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadHistory() {
  try {
    const data = await fs.readFile(HISTORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveHistory(history) {
  await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
}

async function shareRecentAchievements() {
  const agent = new BskyAgent({ service: 'https://bsky.social' }); 
  await agent.login({ identifier: BSKY_HANDLE, password: BSKY_PASSWORD });

  const raAuth = buildAuthorization({ 
    username: RA_USERNAME, 
    webApiKey: RA_API_KEY 
  });

  let achievements = await getUserRecentAchievements(raAuth, { 
    username: RA_USERNAME, 
    recentMinutes: 60 
  });

  if (!achievements || achievements.length === 0) {
    return;
  }

  achievements = achievements.reverse();
  const history = await loadHistory();
  let updatedHistory = false;

  for (const ach of achievements) {
    const uniqueKey = `${ach.gameTitle}-${ach.title}`;

    if (history.includes(uniqueKey)) {
      continue;
    }

    try {
      const badgeUrl = `https://media.retroachievements.org${ach.badgeUrl}`;
      const imageRes = await fetch(badgeUrl);
      
      if (!imageRes.ok) throw new Error(`Failed to fetch image: ${imageRes.statusText}`);
      
      const imageBuffer = await imageRes.arrayBuffer();
      const { data: blobData } = await agent.uploadBlob(new Uint8Array(imageBuffer), {
        encoding: 'image/png'
      });

      const postText = `🏆 I just unlocked an achievement on #RetroAchievements! Follow @bpolzr.me https://retroachievements.org/user/iBlake94
    
${ach.title} (${ach.points}pts)
🎮 ${ach.gameTitle} [${ach.consoleName}]
📝 ${ach.description}`;

      const rt = new RichText({ text: postText });
      await rt.detectFacets(agent);

      await agent.post({
        text: rt.text,
        facets: rt.facets,
        embed: {
          $type: 'app.bsky.embed.images',
          images: [
            {
              image: blobData.blob,
              alt: `Achievement Badge: ${ach.title} from ${ach.gameTitle}`
            }
          ]
        }
      });
      
      history.push(uniqueKey);
      updatedHistory = true;

      await delay(15000);
      
    } catch (error) {
      console.error(`Failed to share ${ach.title}:`, error);
    }
  }

  if (updatedHistory) {
    await saveHistory(history);
  }
}

shareRecentAchievements().catch(console.error);
