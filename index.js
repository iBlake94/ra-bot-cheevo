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

  // --- NEW DEDUPLICATION CODE ---
  console.log("Checking PDS for existing records to avoid duplicates...");

  // Fetch your most recent posts/records
  const existingRecords = await agent.com.atproto.repo.listRecords({
    repo: agent.session.did,
    collection: 'app.bsky.feed.post', 
    limit: 50
  });

  // Filter out any achievement that is already in your recent records
  const newAchievements = achievements.filter(ach => {
    return !existingRecords.data.records.some(record => {
       // record.value.text looks for standard Bluesky posts
       // record.value.achievementTitle looks for the custom Lexicon format
       const recordText = record.value.text || record.value.achievementTitle || ""; 
       return recordText.includes(ach.title);
    });
  });

  if (newAchievements.length === 0) {
    console.log("Achievements found, but they have all been posted already. Skipping!");
    return;
  }
  // ------------------------------

  // 4. Process and post each UNPUBLISHED achievement
  for (const ach of newAchievements) {
      console.log(`Preparing to post: ${ach.title}`);

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
