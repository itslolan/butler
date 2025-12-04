import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://adphex.com';
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/auth/',
          '/demo', // Demo page can be indexed but might want to exclude
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

