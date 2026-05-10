"use client";

import { useEffect } from "react";
import { ToastContainer } from "react-toastify";

const isToastMultiline = (toast: HTMLElement) => {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(toast, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
      const parentElement = node.parentElement;
      if (
        parentElement?.closest(
          ".Toastify__toast-icon, .Toastify__close-button, .Toastify__progress-bar--wrp"
        )
      ) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  return textNodes.some((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const lineTops = new Set(
      Array.from(range.getClientRects()).map((rect) => Math.round(rect.top))
    );
    range.detach();
    return lineTops.size > 1;
  });
};

export const ToastProvider = () => {
  useEffect(() => {
    const updateToastAlignment = () => {
      document.querySelectorAll<HTMLElement>(".Toastify__toast").forEach((toast) => {
        toast.classList.toggle(
          "syncv-toast--multiline",
          isToastMultiline(toast)
        );
      });
    };

    const scheduleUpdate = () => window.requestAnimationFrame(updateToastAlignment);
    const observer = new MutationObserver(scheduleUpdate);

    scheduleUpdate();
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, []);

  return <ToastContainer hideProgressBar position="bottom-right" theme="dark" />;
};
