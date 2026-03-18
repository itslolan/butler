import React from 'react';
import Image from 'next/image';
import { NotionBlock } from '@/lib/notion';

interface RichText {
  type: 'text';
  text: {
    content: string;
    link: { url: string } | null;
  };
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: string;
  };
  plain_text: string;
  href: string | null;
}

function renderRichText(richText: RichText[]): React.ReactNode {
  return richText.map((text, index) => {
    const { annotations, plain_text, href } = text;
    let content: React.ReactNode = plain_text;

    if (annotations.code) {
      content = (
        <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-sm font-mono text-slate-800 dark:text-slate-200">
          {content}
        </code>
      );
    }

    if (annotations.bold) {
      content = <strong className="font-semibold">{content}</strong>;
    }

    if (annotations.italic) {
      content = <em>{content}</em>;
    }

    if (annotations.strikethrough) {
      content = <s>{content}</s>;
    }

    if (annotations.underline) {
      content = <u>{content}</u>;
    }

    if (href) {
      content = (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          {content}
        </a>
      );
    }

    return <React.Fragment key={index}>{content}</React.Fragment>;
  });
}

interface BlockRendererProps {
  block: NotionBlock;
  children?: NotionBlock[];
}

function BlockRenderer({ block, children }: BlockRendererProps): React.ReactElement | null {
  const blockWithChildren = block as NotionBlock & { children?: NotionBlock[] };
  const nestedChildren = blockWithChildren.children || children || [];

  switch (block.type) {
    case 'paragraph': {
      const richText = (block as any).paragraph?.rich_text || [];
      if (richText.length === 0) {
        return <div className="h-4" />;
      }
      return (
        <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
          {renderRichText(richText)}
        </p>
      );
    }

    case 'heading_1': {
      const richText = (block as any).heading_1?.rich_text || [];
      return (
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-8 mb-4 tracking-tight">
          {renderRichText(richText)}
        </h1>
      );
    }

    case 'heading_2': {
      const richText = (block as any).heading_2?.rich_text || [];
      return (
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-6 mb-3 tracking-tight">
          {renderRichText(richText)}
        </h2>
      );
    }

    case 'heading_3': {
      const richText = (block as any).heading_3?.rich_text || [];
      return (
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mt-4 mb-2">
          {renderRichText(richText)}
        </h3>
      );
    }

    case 'bulleted_list_item': {
      const richText = (block as any).bulleted_list_item?.rich_text || [];
      return (
        <li className="text-slate-700 dark:text-slate-300 ml-4 mb-1">
          <span className="flex items-start">
            <span className="mr-2 text-slate-400">•</span>
            <span>{renderRichText(richText)}</span>
          </span>
          {nestedChildren.length > 0 && (
            <ul className="mt-1 ml-4">
              {nestedChildren.map((child) => (
                <BlockRenderer key={child.id} block={child} />
              ))}
            </ul>
          )}
        </li>
      );
    }

    case 'numbered_list_item': {
      const richText = (block as any).numbered_list_item?.rich_text || [];
      return (
        <li className="text-slate-700 dark:text-slate-300 ml-4 mb-1 list-decimal list-inside">
          {renderRichText(richText)}
          {nestedChildren.length > 0 && (
            <ol className="mt-1 ml-4">
              {nestedChildren.map((child) => (
                <BlockRenderer key={child.id} block={child} />
              ))}
            </ol>
          )}
        </li>
      );
    }

    case 'to_do': {
      const richText = (block as any).to_do?.rich_text || [];
      const checked = (block as any).to_do?.checked || false;
      return (
        <div className="flex items-start gap-2 mb-2">
          <input
            type="checkbox"
            checked={checked}
            readOnly
            className="mt-1 h-4 w-4 rounded border-slate-300 dark:border-slate-600"
          />
          <span
            className={`text-slate-700 dark:text-slate-300 ${
              checked ? 'line-through text-slate-400 dark:text-slate-500' : ''
            }`}
          >
            {renderRichText(richText)}
          </span>
        </div>
      );
    }

    case 'toggle': {
      const richText = (block as any).toggle?.rich_text || [];
      return (
        <details className="mb-4 group">
          <summary className="cursor-pointer text-slate-700 dark:text-slate-300 font-medium hover:text-slate-900 dark:hover:text-white transition-colors">
            {renderRichText(richText)}
          </summary>
          <div className="mt-2 ml-4 pl-4 border-l-2 border-slate-200 dark:border-slate-700">
            {nestedChildren.map((child) => (
              <BlockRenderer key={child.id} block={child} />
            ))}
          </div>
        </details>
      );
    }

    case 'quote': {
      const richText = (block as any).quote?.rich_text || [];
      return (
        <blockquote className="border-l-4 border-blue-500 dark:border-blue-400 pl-4 py-1 my-4 text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/50 rounded-r">
          {renderRichText(richText)}
        </blockquote>
      );
    }

    case 'code': {
      const richText = (block as any).code?.rich_text || [];
      const language = (block as any).code?.language || 'plain text';
      const code = richText.map((t: RichText) => t.plain_text).join('');

      return (
        <div className="my-4 rounded-lg overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
            </div>
            <span className="text-xs text-slate-400 font-mono">{language}</span>
          </div>
          <pre className="p-4 overflow-x-auto bg-slate-900 dark:bg-slate-950">
            <code className="text-sm font-mono text-slate-100">{code}</code>
          </pre>
        </div>
      );
    }

    case 'divider': {
      return <hr className="my-6 border-slate-200 dark:border-slate-700" />;
    }

    case 'image': {
      const imageBlock = (block as any).image;
      const url =
        imageBlock?.type === 'external'
          ? imageBlock.external?.url
          : imageBlock?.file?.url;
      const caption = imageBlock?.caption || [];
      const captionText = caption.map((t: RichText) => t.plain_text).join('');

      if (!url) return null;

      return (
        <figure className="my-6">
          <div className="relative w-full overflow-hidden rounded-lg shadow-md">
            <Image
              src={url}
              alt={captionText || 'Blog image'}
              width={800}
              height={400}
              className="w-full h-auto object-cover"
              unoptimized
            />
          </div>
          {captionText && (
            <figcaption className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
              {captionText}
            </figcaption>
          )}
        </figure>
      );
    }

    case 'callout': {
      const richText = (block as any).callout?.rich_text || [];
      const icon = (block as any).callout?.icon;
      const emoji = icon?.type === 'emoji' ? icon.emoji : '💡';
      const color = (block as any).callout?.color || 'gray_background';

      const bgColorClass = color.includes('blue')
        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
        : color.includes('green')
        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
        : color.includes('yellow')
        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
        : color.includes('red')
        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700';

      return (
        <div className={`flex gap-3 p-4 rounded-lg my-4 border ${bgColorClass}`}>
          <span className="text-xl flex-shrink-0">{emoji}</span>
          <div className="text-slate-700 dark:text-slate-300">
            {renderRichText(richText)}
          </div>
        </div>
      );
    }

    case 'bookmark': {
      const url = (block as any).bookmark?.url || '';
      const caption = (block as any).bookmark?.caption || [];
      const captionText = caption.map((t: RichText) => t.plain_text).join('');

      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block my-4 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all bg-white dark:bg-slate-800"
        >
          <div className="text-blue-600 dark:text-blue-400 font-medium truncate">
            {captionText || url}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400 truncate mt-1">
            {url}
          </div>
        </a>
      );
    }

    case 'video': {
      const videoBlock = (block as any).video;
      const url =
        videoBlock?.type === 'external'
          ? videoBlock.external?.url
          : videoBlock?.file?.url;

      if (!url) return null;

      // Handle YouTube embeds
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const videoId = url.includes('youtu.be')
          ? url.split('/').pop()
          : new URL(url).searchParams.get('v');
        return (
          <div className="my-6 aspect-video rounded-lg overflow-hidden shadow-md">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        );
      }

      return (
        <video
          src={url}
          controls
          className="w-full my-6 rounded-lg shadow-md"
        />
      );
    }

    case 'embed': {
      const url = (block as any).embed?.url || '';
      return (
        <div className="my-6 aspect-video rounded-lg overflow-hidden shadow-md">
          <iframe src={url} className="w-full h-full" allowFullScreen />
        </div>
      );
    }

    case 'table': {
      const tableWidth = (block as any).table?.table_width || 0;
      const hasColumnHeader = (block as any).table?.has_column_header || false;
      const hasRowHeader = (block as any).table?.has_row_header || false;

      return (
        <div className="my-6 overflow-x-auto">
          <table className="min-w-full border-collapse border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <tbody>
              {nestedChildren.map((row, rowIndex) => {
                const cells = (row as any).table_row?.cells || [];
                return (
                  <tr
                    key={row.id}
                    className={
                      hasColumnHeader && rowIndex === 0
                        ? 'bg-slate-100 dark:bg-slate-800'
                        : ''
                    }
                  >
                    {cells.map((cell: RichText[], cellIndex: number) => {
                      const isHeader =
                        (hasColumnHeader && rowIndex === 0) ||
                        (hasRowHeader && cellIndex === 0);
                      const CellTag = isHeader ? 'th' : 'td';
                      return (
                        <CellTag
                          key={cellIndex}
                          className={`border border-slate-200 dark:border-slate-700 px-4 py-2 text-left ${
                            isHeader
                              ? 'font-semibold text-slate-900 dark:text-white'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {renderRichText(cell)}
                        </CellTag>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    case 'table_row': {
      return null;
    }

    case 'column_list': {
      return (
        <div className="flex flex-col md:flex-row gap-4 my-4">
          {nestedChildren.map((child) => (
            <BlockRenderer key={child.id} block={child} />
          ))}
        </div>
      );
    }

    case 'column': {
      return (
        <div className="flex-1">
          {nestedChildren.map((child) => (
            <BlockRenderer key={child.id} block={child} />
          ))}
        </div>
      );
    }

    default: {
      return null;
    }
  }
}

interface NotionBlockRendererProps {
  blocks: NotionBlock[];
}

export default function NotionBlockRenderer({
  blocks,
}: NotionBlockRendererProps): React.ReactElement {
  const groupedBlocks: React.ReactNode[] = [];
  let currentListItems: NotionBlock[] = [];
  let currentListType: 'bulleted' | 'numbered' | null = null;

  const flushList = () => {
    if (currentListItems.length > 0) {
      const ListTag = currentListType === 'numbered' ? 'ol' : 'ul';
      groupedBlocks.push(
        <ListTag
          key={`list-${groupedBlocks.length}`}
          className={`my-4 ${currentListType === 'numbered' ? 'list-decimal' : ''}`}
        >
          {currentListItems.map((item) => (
            <BlockRenderer key={item.id} block={item} />
          ))}
        </ListTag>
      );
      currentListItems = [];
      currentListType = null;
    }
  };

  for (const block of blocks) {
    if (block.type === 'bulleted_list_item') {
      if (currentListType !== 'bulleted') {
        flushList();
        currentListType = 'bulleted';
      }
      currentListItems.push(block);
    } else if (block.type === 'numbered_list_item') {
      if (currentListType !== 'numbered') {
        flushList();
        currentListType = 'numbered';
      }
      currentListItems.push(block);
    } else {
      flushList();
      groupedBlocks.push(<BlockRenderer key={block.id} block={block} />);
    }
  }

  flushList();

  return <>{groupedBlocks}</>;
}
