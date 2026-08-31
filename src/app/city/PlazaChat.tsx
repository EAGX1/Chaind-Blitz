import { useEffect, useState } from "react";
import { isOnline, onPlazaChat, sendChat } from "../../meta/plazaNet.js";
import { t } from "../../meta/i18n.js";

type Line = { name?: string; msg: string };

export function PlazaChat() {
  const [online, setOnline] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const tick = window.setInterval(() => setOnline(isOnline()), 1200);
    const off = onPlazaChat((msg: { name?: string; msg: string }) => {
      setLines((prev) => [...prev.slice(-20), { name: msg.name, msg: msg.msg }]);
    });
    return () => { window.clearInterval(tick); off(); };
  }, []);

  if (!online) return null;

  return (
    <div className="city-chat">
      <p className="city-chat-title">{t("plaza.chat")}</p>
      <div className="city-chat-log">
        {lines.map((l, i) => (
          <p key={i}><b>{l.name || "Duelist"}:</b> {l.msg}</p>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          sendChat(draft.trim());
          setDraft("");
        }}
      >
        <input
          className="cb-input"
          value={draft}
          maxLength={240}
          placeholder={t("plaza.chat")}
          onChange={(e) => setDraft(e.target.value)}
        />
      </form>
    </div>
  );
}
