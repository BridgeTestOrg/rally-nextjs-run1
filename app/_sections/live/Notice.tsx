import Image from "next/image";
import { content } from "@/lib/content";
import unavailableIcon from "./conditions-unavailable.svg";

/** Replaces the card grid when no city has weather to show. */
export function Notice() {
  const { live } = content;

  return (
    <div className="rally-live__notice">
      <Image
        src={unavailableIcon}
        alt=""
        width={28}
        height={28}
        className="rally-live__notice-icon"
      />
      <div className="rally-live__notice-text">
        <h3 className="rally-live__notice-title">{live.allUnavailableTitle}</h3>
        <p className="rally-live__notice-body">{live.allUnavailableBody}</p>
      </div>
    </div>
  );
}
