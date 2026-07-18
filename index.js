import { BskyAgent } from '@atproto/api';
import { buildAuthorization, getUserRecentAchievements } from '@retroachievements/api';
import * as dotenv from 'dotenv';

dotenv.config();

// Load Credentials
const { RA_USERNAME, RA_API_KEY, BSKY_HANDLE, BSKY_PASSWORD } = process.env;

async function shareRecentAchievements() {
  console.log("Connecting to the AT Protocol...");
  
  const agent = new BskyAgent({ service: 'https://bsky.social' }); 
  await agent.login({ identifier: BSKY_HANDLE, password: BSKY_PASSWORD });

  const raAuth = buildAuthorization({ 
    username: RA_USERNAME, 
    webApiKey: RA_API_KEY 
  });

  console.log("Checking for recent RetroAchievements...");
  
  const achievements = await getUserRecentAchievements(raAuth, { 
    username: RA_USERNAME, 
    recentMinutes: 60 
  });

  if (!achievements || achievements.length === 0) {
    console.log("No new achievements found in the last hour.");
    return;
  }

  for (const ach of achievements) {
    console.log(`Preparing to post: ${ach.title}`);

    const badgeUrl = `https://media.retroachievements.org${ach.badgeUrl}`;
    const imageRes = await fetch(badgeUrl);
    const imageBuffer = await imageRes.arrayBuffer();

    const { data: blobData } = await agent.uploadBlob(new Uint8Array(imageBuffer), {
      encoding: 'image/png'
    });

    const postText = `🏆 I just unlocked an achievement on #RetroAchievements! Follow me https://retroachievements.org/user/iBlake94
    
${ach.title} (${ach.points}pts)
🎮 ${ach.gameTitle} [${ach.consoleName}]
📝 ${ach.description}`;

    await agent.post({
      text: postText,
      embed: {
        $type: 'app.bsky.embed.images',
        images: [
          {
            image: blobData.blob,
            alt: `Achievement Badge: ${ach.title}`
          }
        ]
      }
    });

    console.log(`✅ Successfully shared: ${ach.title}`);
  }
}

shareRecentAchievements().catch(console.error);
