import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import type { DealDocument } from '../api';

// react-pdf needs the worker set in the same module that renders <Document>.
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

const TYPE_LABEL = { agreement: 'Agreement', schedule: 'Schedule', amendment: 'Amendment', supporting: 'Supporting' };
const ZOOMS = [0.75, 1, 1.25, 1.5, 2];

type Props = {
  documents: DealDocument[];
  docId: string;
  page: number; // the page to bring into view
  request: number; // changes each time a page is asked for, so asking for the same page again still scrolls
  sourceDocId?: string; // document holding the selected field's source
  onNavigate: (docId: string, page: number) => void;
};

export function DocumentViewer({ documents, docId, page, request, sourceDocId, onNavigate }: Props) {
  const doc = documents.find((d) => d.id === docId) ?? documents[0];
  // `shape` is a page's height divided by its width, used to reserve room for pages not yet drawn.
  const [loaded, setLoaded] = useState<{ id: string; pages: number; shape: number }>();
  const [current, setCurrent] = useState(1);
  const pageElements = useRef<Record<number, HTMLDivElement | null>>({});
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    if (stage.current) observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);

  // The documents are a set of tabs, so they follow the keyboard pattern for tabs: one stop for
  // the Tab key, then the arrow keys, Home and End move between documents.
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({});
  function onTabKey(event: KeyboardEvent) {
    // Start from the tab that has the focus, not the one last drawn, so that holding a key down keeps pace.
    const focused = documents.findIndex((d) => tabs.current[d.id] === document.activeElement);
    const index = focused >= 0 ? focused : documents.findIndex((d) => d.id === doc.id);
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: documents.length - 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const target = documents[(moves[event.key] + documents.length) % documents.length];
    onNavigate(target.id, 1);
    tabs.current[target.id]?.focus();
  }

  // If there are too many documents to fit, keep the open one in view.
  useEffect(() => {
    tabs.current[doc.id]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [doc.id]);

  const pages = loaded?.id === doc.id ? loaded.pages : undefined;
  const pageWidth = Math.min(width - 48, 860) * zoom;
  const zoomIndex = ZOOMS.indexOf(zoom);

  // All pages are drawn one under the other, so the document scrolls from start to end and the
  // browser's own find (Ctrl+F) searches the whole of it.
  // shortcut: every page is drawn at once, which suits documents of a few dozen pages. A long
  // agreement would need only the pages near the view drawn.
  function scrollToPage(number: number) {
    const element = pageElements.current[number];
    if (!element || !stage.current) return;
    stage.current.scrollTo({ top: number === 1 ? 0 : element.offsetTop - 12 });
    setCurrent(number);
  }

  // Bring the requested page into view: when a field's source is opened, or a document chosen.
  useEffect(() => {
    if (pages) scrollToPage(Math.min(page, pages));
    // Runs when a page is asked for or the document finishes loading, not on every redraw.
  }, [doc.id, page, request, pages]);

  // The page number shown is whichever page is at the reading position, a third of the way down.
  function onScroll() {
    if (!stage.current || !pages) return;
    const readingLine = stage.current.scrollTop + stage.current.clientHeight / 3;
    let reading = 1;
    for (let number = 1; number <= pages; number++) {
      const element = pageElements.current[number];
      if (element && element.offsetTop <= readingLine) reading = number;
    }
    setCurrent(reading);
  }

  return (
    <section className="viewer" aria-label="Documents">
      <div className="doc-bar">
        <span className="doc-count">
          Documents <strong>{documents.length}</strong>
        </span>
        <div className="doc-tabs" role="tablist" aria-label="Documents in this deal" onKeyDown={onTabKey}>
          {documents.map((d) => (
            <button
              key={d.id}
              ref={(element) => {
                tabs.current[d.id] = element;
              }}
              id={`doc-tab-${d.id}`}
              role="tab"
              aria-selected={d.id === doc.id}
              aria-controls="doc-panel"
              tabIndex={d.id === doc.id ? 0 : -1}
              className="doc-tab"
              title={d.title}
              onClick={() => onNavigate(d.id, 1)}
            >
              <span className="doc-tab-title">
                {d.title}
                {d.id === sourceDocId && <span className="source-dot" title="Source of the selected field" />}
              </span>
              <span className="doc-tab-meta">{[TYPE_LABEL[d.type], d.dated].filter(Boolean).join(' · ')}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="viewer-toolbar">
        <div className="toolbar-group">
          <button
            className="icon-btn"
            aria-label="Previous page"
            disabled={current <= 1}
            onClick={() => scrollToPage(current - 1)}
          >
            <ChevronLeft size={18} />
          </button>
          <span>
            Page {pages ? current : 1} of {pages ?? '…'}
          </span>
          <button
            className="icon-btn"
            aria-label="Next page"
            disabled={!pages || current >= pages}
            onClick={() => scrollToPage(current + 1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="toolbar-group">
          <button
            className="icon-btn"
            aria-label="Zoom out"
            disabled={zoomIndex === 0}
            onClick={() => setZoom(ZOOMS[zoomIndex - 1])}
          >
            <Minus size={16} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            className="icon-btn"
            aria-label="Zoom in"
            disabled={zoomIndex === ZOOMS.length - 1}
            onClick={() => setZoom(ZOOMS[zoomIndex + 1])}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Focusable so that the page can be scrolled from the keyboard. */}
      <div
        className="viewer-stage"
        ref={stage}
        role="tabpanel"
        id="doc-panel"
        aria-labelledby={`doc-tab-${doc.id}`}
        tabIndex={0}
        onScroll={onScroll}
      >
        {width > 0 && (
          <Document
            key={doc.id}
            file={doc.file}
            onLoadSuccess={async (pdf) => {
              const first = (await pdf.getPage(1)).getViewport({ scale: 1 });
              setLoaded({ id: doc.id, pages: pdf.numPages, shape: first.height / first.width });
            }}
            loading={<p className="viewer-message">Loading document…</p>}
            error={
              <p className="viewer-message" role="alert">
                This document could not be loaded. The extracted details can still be reviewed.
              </p>
            }
          >
            {loaded?.id === doc.id &&
              Array.from({ length: loaded.pages }, (_, index) => (
                <div
                  key={index}
                  className="pdf-page"
                  ref={(element) => {
                    pageElements.current[index + 1] = element;
                  }}
                  // Room is kept for each page before it is drawn, so a jump to a later page lands in the right place.
                  style={{ minHeight: pageWidth * loaded.shape }}
                >
                  <Page pageNumber={index + 1} width={pageWidth} renderAnnotationLayer={false} loading="" />
                </div>
              ))}
          </Document>
        )}
      </div>
    </section>
  );
}
