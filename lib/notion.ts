import { Client } from '@notionhq/client';
import {
  PageObjectResponse,
  BlockObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';

function getNotionClient(): Client | null {
  if (!process.env.NOTION_API_KEY) return null;
  return new Client({ auth: process.env.NOTION_API_KEY });
}

function getDatabaseId(): string {
  return process.env.NOTION_BLOG_DATABASE_ID || '';
}

let cachedDataSourceId: string | null = null;

async function getDataSourceId(notion: Client, databaseId: string): Promise<string | null> {
  if (cachedDataSourceId) return cachedDataSourceId;
  
  try {
    const database = await notion.databases.retrieve({ database_id: databaseId });
    if ('data_sources' in database && Array.isArray((database as any).data_sources)) {
      const dataSources = (database as any).data_sources;
      if (dataSources.length > 0) {
        cachedDataSourceId = dataSources[0].id;
        return cachedDataSourceId;
      }
    }
    // Fallback: use database_id as data_source_id (for older databases)
    cachedDataSourceId = databaseId;
    return cachedDataSourceId;
  } catch (error) {
    console.error('[Notion] Failed to get data source ID:', error);
    return databaseId;
  }
}

// Types
export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  date: string;
  excerpt: string;
}

export type NotionBlock = BlockObjectResponse;

// Helper to slugify titles
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Extract text from Notion rich text array
function extractText(richText: Array<{ plain_text: string }>): string {
  return richText.map((t) => t.plain_text).join('');
}

// Extract property value from Notion page
function extractProperty(page: PageObjectResponse, propertyName: string): string {
  const property = page.properties[propertyName];
  if (!property) return '';

  switch (property.type) {
    case 'title':
      return extractText(property.title);
    case 'rich_text':
      return extractText(property.rich_text);
    case 'date':
      return property.date?.start || '';
    case 'status':
      return property.status?.name || '';
    default:
      return '';
  }
}

// Parse a Notion page into a BlogPost
function parsePageToPost(page: PageObjectResponse): BlogPost {
  const title = extractProperty(page, 'Title') || extractProperty(page, 'Name') || 'Untitled';
  const slugProperty = extractProperty(page, 'Slug');
  const slug = slugProperty || slugify(title);
  const publishedDate = extractProperty(page, 'Published Date');
  const dateProperty = extractProperty(page, 'Date');
  const date = publishedDate || dateProperty || '';
  const excerpt = extractProperty(page, 'Excerpt') || '';

  return {
    id: page.id,
    title,
    slug,
    date,
    excerpt,
  };
}

// Get all published blog posts
export async function getPublishedPosts(): Promise<BlogPost[]> {
  const notion = getNotionClient();
  const databaseId = getDatabaseId();
  
  if (!notion || !databaseId) {
    console.warn('[Notion] Missing API key or database ID');
    return [];
  }

  try {
    const dataSourceId = await getDataSourceId(notion, databaseId);
    if (!dataSourceId) {
      console.warn('[Notion] Could not determine data source ID');
      return [];
    }

    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: {
        property: 'Status',
        status: {
          equals: 'Published',
        },
      },
      sorts: [
        {
          property: 'Published Date',
          direction: 'descending',
        },
      ],
    });

    const posts: BlogPost[] = [];

    for (const page of response.results) {
      if ('properties' in page) {
        posts.push(parsePageToPost(page as PageObjectResponse));
      }
    }

    return posts;
  } catch (error) {
    console.error('[Notion] Failed to fetch posts:', error);
    return [];
  }
}

// Get a single post by slug
export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const notion = getNotionClient();
  const databaseId = getDatabaseId();
  
  if (!notion || !databaseId) {
    console.warn('[Notion] Missing API key or database ID');
    return null;
  }

  try {
    const dataSourceId = await getDataSourceId(notion, databaseId);
    if (!dataSourceId) {
      console.warn('[Notion] Could not determine data source ID');
      return null;
    }

    // First try to find by Slug property
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: {
        and: [
          {
            property: 'Status',
            status: {
              equals: 'Published',
            },
          },
          {
            property: 'Slug',
            rich_text: {
              equals: slug,
            },
          },
        ],
      },
    });

    if (response.results.length > 0) {
      const page = response.results[0];
      if ('properties' in page) {
        return parsePageToPost(page as PageObjectResponse);
      }
    }

    // If not found by slug, search all posts and match by generated slug
    const allPosts = await getPublishedPosts();
    return allPosts.find((p) => p.slug === slug) || null;
  } catch (error) {
    console.error('[Notion] Failed to fetch post by slug:', error);
    return null;
  }
}

// Fetch all blocks from a page (with pagination and recursive child fetching)
export async function getPageBlocks(pageId: string): Promise<NotionBlock[]> {
  const notion = getNotionClient();
  
  if (!notion) {
    console.warn('[Notion] Missing API key');
    return [];
  }

  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;

  try {
    // Paginate through all blocks
    do {
      const response = await notion.blocks.children.list({
        block_id: pageId,
        start_cursor: cursor,
        page_size: 100,
      });

      for (const block of response.results) {
        if ('type' in block) {
          const typedBlock = block as NotionBlock;
          blocks.push(typedBlock);

          // Recursively fetch children if the block has them
          if (typedBlock.has_children) {
            const children = await getPageBlocks(typedBlock.id);
            // Store children in a custom property for rendering
            (typedBlock as any).children = children;
          }
        }
      }

      cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
    } while (cursor);

    return blocks;
  } catch (error) {
    console.error('[Notion] Failed to fetch blocks:', error);
    return [];
  }
}
