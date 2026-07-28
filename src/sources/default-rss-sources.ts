export type DefaultRssSource = {
  name: string;
  url: string;
};

export const DEFAULT_RSS_SOURCES: DefaultRssSource[] = [
  {
    name: 'Ynet',
    url: 'https://www.ynet.co.il/Integration/StoryRss1854.xml',
  },
  {
    name: 'Walla',
    url: 'https://rss.walla.co.il/feed/22',
  },
  {
    name: 'Globes',
    url: 'https://www.globes.co.il/webservices/rss/rssma.aspx',
  },
];
