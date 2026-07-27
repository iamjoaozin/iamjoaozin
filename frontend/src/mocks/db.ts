export const MOCK_DB = {
  subreddits: [
    { id: 'sub-1', name: 'r/DigitalArt', status: 'active', priority: 'high', cooldownEnd: null, rules: { title_regex: '^[OC]' } },
    { id: 'sub-2', name: 'r/FantasyArt', status: 'cooldown', priority: 'high', cooldownEnd: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), rules: {} },
    { id: 'sub-3', name: 'r/DnD', status: 'active', priority: 'medium', cooldownEnd: null, rules: {} },
    { id: 'sub-4', name: 'r/AnimeSketch', status: 'cooldown', priority: 'low', cooldownEnd: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), rules: {} },
    { id: 'sub-5', name: 'r/HungryArtists', status: 'active', priority: 'high', cooldownEnd: null, rules: {} }
  ],
  templates: [
    { id: 'tpl-1', title: '[OC] Character Design - Commissions Open', body: 'Hi guys, this is my latest commission piece...' },
    { id: 'tpl-2', title: '[ART] Fantasy Landscape', body: 'Environment concept art done in Photoshop.' }
  ],
  images: Array.from({ length: 50 }).map((_, i) => ({
    id: `img-${i}`,
    phash: `hash-${i * 100}`,
    url: `https://picsum.photos/seed/${i + 10}/400/600`,
    favorite: i % 5 === 0,
    usages: Math.floor(Math.random() * 20),
    score: Math.floor(Math.random() * 100),
    categories: i % 2 === 0 ? ['fantasy'] : ['scifi'],
    tags: ['commission', 'portrait']
  })),
  drafts: [
    { id: 'draft-1', subreddit_id: 'sub-1', template_id: 'tpl-1', image_ids: ['img-1'], status: 'pending', created_at: new Date().toISOString() },
    { id: 'draft-2', subreddit_id: 'sub-5', template_id: 'tpl-2', image_ids: ['img-2', 'img-3'], status: 'approved', created_at: new Date().toISOString() }
  ],
  jobs: [
    { id: 'job-1', draft_id: 'draft-2', status: 'running', attempts: 1, scheduled_for: new Date().toISOString() },
    { id: 'job-2', draft_id: 'draft-1', status: 'failed', attempts: 3, scheduled_for: new Date(Date.now() - 3600000).toISOString(), error: 'Reddit API Rate Limit' }
  ]
};
