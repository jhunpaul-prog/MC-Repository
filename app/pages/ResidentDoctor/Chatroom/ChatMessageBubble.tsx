import React from "react";

type Props = {
  msg: { from: string; text: string; at: any };
  mine: boolean;
};

const ChatMessageBubble: React.FC<Props> = ({ msg, mine }) => {
  return (
    <div
      className={`w-full flex ${mine ? "justify-end" : "justify-start"} mb-2`}
    >
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow
          ${mine ? "bg-red-600 text-white" : "bg-white border"}`}
      >
        <div className="whitespace-pre-wrap break-words">{msg.text}</div>
      </div>
    </div>
  );
};

export default ChatMessageBubble;
