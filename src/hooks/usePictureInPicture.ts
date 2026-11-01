'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Type definitions for W3C Document Picture-in-Picture API
interface DocumentPictureInPictureOptions {
  width?: number;
  height?: number;
  disallowReturnToOpener?: boolean;
}

interface DocumentPictureInPictureAPI extends EventTarget {
  requestWindow(options?: DocumentPictureInPictureOptions): Promise<Window>;
  window: Window | null;
  onenter: ((this: DocumentPictureInPictureAPI, ev: Event) => void) | null;
}

export function usePictureInPicture(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const pipWindowRef = useRef<Window | null>(null);
  const placeholderRef = useRef<Comment | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasDocPiP = 'documentPictureInPicture' in window;
      const hasVideoPiP = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document;
      setIsSupported(Boolean(hasDocPiP || hasVideoPiP));
    }
  }, []);

  const closePiP = useCallback(() => {
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.close();
    }
    if (typeof document !== 'undefined' && document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    }
  }, []);

  const togglePiP = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    // If already active, close it
    if (isPiPActive) {
      closePiP();
      return;
    }

    // 1. Try Document Picture-in-Picture API (works for iframe & video, modern Chromium)
    if (typeof window !== 'undefined' && 'documentPictureInPicture' in window) {
      try {
        const docPiP = (window as unknown as { documentPictureInPicture: DocumentPictureInPictureAPI }).documentPictureInPicture;
        const pipWindow = await docPiP.requestWindow({
          width: 640,
          height: 360,
        });
        pipWindowRef.current = pipWindow;

        // Copy styles from current document to PiP window
        Array.from(document.styleSheets).forEach((sheet) => {
          try {
            const cssRules = Array.from(sheet.cssRules)
              .map((rule) => rule.cssText)
              .join('');
            const style = document.createElement('style');
            style.textContent = cssRules;
            pipWindow.document.head.appendChild(style);
          } catch {
            if (sheet.href) {
              const link = document.createElement('link');
              link.rel = 'stylesheet';
              link.href = sheet.href;
              pipWindow.document.head.appendChild(link);
            }
          }
        });

        // Insert placeholder to preserve original position in DOM
        const parent = container.parentElement;
        if (parent) {
          const placeholder = document.createComment('pip-placeholder');
          parent.insertBefore(placeholder, container);
          placeholderRef.current = placeholder;
        }

        // Style the PiP window body
        pipWindow.document.body.style.margin = '0';
        pipWindow.document.body.style.padding = '0';
        pipWindow.document.body.style.backgroundColor = '#000';
        pipWindow.document.body.style.overflow = 'hidden';
        pipWindow.document.body.style.display = 'flex';
        pipWindow.document.body.style.alignItems = 'center';
        pipWindow.document.body.style.justifyContent = 'center';

        // Move the player container into the PiP window
        pipWindow.document.body.appendChild(container);
        setIsPiPActive(true);

        // When user closes the PiP window, return container back to the main document
        const handlePiPClose = () => {
          if (placeholderRef.current && placeholderRef.current.parentElement) {
            placeholderRef.current.parentElement.insertBefore(container, placeholderRef.current);
            placeholderRef.current.remove();
            placeholderRef.current = null;
          }
          pipWindowRef.current = null;
          setIsPiPActive(false);
        };

        pipWindow.addEventListener('pagehide', handlePiPClose, { once: true });
        return;
      } catch (err) {
        console.warn('Document Picture-in-Picture failed, trying native video PiP fallback:', err);
      }
    }

    // 2. Fallback: Native HTMLVideoElement PiP
    const video = container.querySelector('video');
    if (video) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
          setIsPiPActive(false);
        } else if (document.pictureInPictureEnabled) {
          await video.requestPictureInPicture();
          setIsPiPActive(true);
          video.addEventListener(
            'leavepictureinpicture',
            () => {
              setIsPiPActive(false);
            },
            { once: true }
          );
        }
      } catch (videoErr) {
        console.warn('Native video PiP failed:', videoErr);
      }
    }
  }, [containerRef, isPiPActive, closePiP]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      closePiP();
    };
  }, [closePiP]);

  return {
    isPiPActive,
    isSupported,
    togglePiP,
    closePiP,
  };
}
