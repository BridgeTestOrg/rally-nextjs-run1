import Image from "next/image";
import { content } from "@/lib/content";
import { Button } from "./Button";

export function Header() {
  const { header, site } = content;

  return (
    <header className="rally-header">
      <div className="rally-container rally-header__inner">
        <div className="rally-wordmark">
          <Image src="/logo.svg" alt="" width={30} height={30} />
          <span>{site.name}</span>
        </div>
        <nav aria-label={header.navLabel} className="rally-header__nav">
          <ul className="rally-header__links">
            {header.nav.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="rally-header__link">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <Button variant="ball" href="#waitlist">
            {header.cta}
          </Button>
        </nav>
      </div>
    </header>
  );
}
