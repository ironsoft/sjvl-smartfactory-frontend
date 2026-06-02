import { generateHTML, Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";

// 읽기 전용 뷰에서도 저장된 width 속성을 렌더링
const ImageWithWidth = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) =>
          el.getAttribute("width") ||
          (el as HTMLElement).style.width?.replace("px", "") ||
          null,
        renderHTML: (attrs) =>
          attrs.width
            ? { width: attrs.width, style: `width: ${attrs.width}px; max-width: 100%;` }
            : {},
      },
    };
  },
});

// 읽기 전용 VideoNode (ReactNodeViewRenderer 없이 renderHTML만)
const VideoNodeReadOnly = Node.create({
  name: "video",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      src:       { default: null },
      thumbnail: { default: null },
      width:     { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-video-src]" }];
  },
  renderHTML({ HTMLAttributes }) {
    const { src, width } = HTMLAttributes;
    const style = [
      "position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:8px;margin:16px 0;",
      width ? `width:${width}px;max-width:100%;` : "width:100%;",
    ].join("");
    return [
      "div",
      { "data-video-src": src ?? "", style },
      [
        "iframe",
        {
          src: src ?? "",
          style: "position:absolute;top:0;left:0;width:100%;height:100%;border:none;",
          allow: "accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture",
          allowfullscreen: "true",
          frameborder: "0",
        },
      ],
    ];
  },
});

const EXTENSIONS = [
  StarterKit,
  ImageWithWidth,
  VideoNodeReadOnly,
  Link,
  Underline,
  TextStyle,
  Color,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
];

export function useEditorContent(content: Record<string, unknown>) {
  let renderContent = "";
  try {
    if (content && Object.keys(content).length > 0) {
      renderContent = generateHTML(content as Parameters<typeof generateHTML>[0], EXTENSIONS);
    }
  } catch {
    renderContent = "";
  }
  return { renderContent };
}
