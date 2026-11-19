import { content } from "@/lib/content";

export function Footer() {
  const { footer } = content;

  return (
    <footer className="rally-footer">
      <div className="rally-container rally-footer__inner">
        <p>{footer.legal}</p>
        <div className="rally-footer__links">
          <a href="#faq" className="rally-footer__link">
            {footer.faq}
          </a>
          <a href={`mailto:${footer.email}`} className="rally-footer__link">
            {footer.email}
          </a>
        </div>
      </div>
    </footer>
  );
}
