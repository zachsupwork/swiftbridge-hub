import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SeoContentBlockProps {
  children: React.ReactNode;
  /** Initially collapsed on mobile for UX */
  defaultOpen?: boolean;
}

/**
 * Collapsible SEO content block rendered ABOVE the interactive UI.
 * Content is always in the DOM for crawlers; collapsed state is visual only.
 */
export function SeoContentBlock({ children, defaultOpen = false }: SeoContentBlockProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="max-w-4xl mx-auto mb-8">
      <div
        className={cn(
          'relative overflow-hidden transition-all duration-300',
          open ? 'max-h-[5000px]' : 'max-h-48'
        )}
      >
        <div className="prose prose-invert prose-sm max-w-none text-muted-foreground [&_h1]:text-foreground [&_h1]:text-2xl [&_h1]:md:text-3xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-2 [&_p]:mb-3 [&_p]:leading-relaxed [&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3">
          {children}
        </div>
        {!open && (
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        )}
      </div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors"
      >
        {open ? (
          <>
            Show less <ChevronUp className="w-3 h-3" />
          </>
        ) : (
          <>
            Read more <ChevronDown className="w-3 h-3" />
          </>
        )}
      </button>
    </section>
  );
}
