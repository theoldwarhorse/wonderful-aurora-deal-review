// The bar across the top of every screen: the bank's name on the left, and on the right the two
// sections and the user's role.
import { LayoutGrid, Settings } from 'lucide-react';

type Props = { section: 'deals' | 'admin'; title: string };

export function AppHeader({ section, title }: Props) {
  return (
    <header className="topbar">
      <a href="#/" className="brand" aria-label="Aurora Bank, home">
        <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden>
          <rect
            x="1.25"
            y="1.25"
            width="29.5"
            height="29.5"
            rx="7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M9 23 16 9l7 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="brand-name">
          <strong>Aurora</strong> Bank
        </span>
      </a>

      <nav className="topnav" aria-label="Sections">
        <a href="#/" aria-current={section === 'deals' ? 'page' : undefined}>
          <LayoutGrid size={15} aria-hidden /> Deals
        </a>
        <a href="#/admin" aria-current={section === 'admin' ? 'page' : undefined}>
          <Settings size={15} aria-hidden /> Admin
        </a>
      </nav>

      {/* There is no sign-in, so nobody is named. This is the job title actions are recorded under. */}
      <span className="role">{title}</span>
    </header>
  );
}
