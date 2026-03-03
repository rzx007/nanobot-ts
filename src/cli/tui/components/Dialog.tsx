import { useState, useContext, createContext, useRef, type ReactNode } from 'react';
import { useKeyboard, useRenderer } from '@opentui/react';

export interface DialogContextValue {
  stack: Array<{
    element: ReactNode;
    onClose?: () => void;
  }>;
  clear: () => void;
  replace: (element: ReactNode, onClose?: () => void) => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export { DialogContext };

export interface DialogProps {
  children: ReactNode;
  onClose: () => void;
  size?: 'medium' | 'large';
}

export function Dialog(props: DialogProps) {
  const contentClickRef = useRef(false);

  return (
    <box
      position="absolute"
      top={0}
      left={0}
      width="100%"
      height="100%"
      backgroundColor="#00000088"
      alignItems="center"
      justifyContent="center"
      onMouseDown={() => {
        // 重置标记
        contentClickRef.current = false;
      }}
      onMouseUp={evt => {
        // 如果在内容区域点击过，不关闭
        if (contentClickRef.current) {
          return;
        }
        if (evt.defaultPrevented) {
          return;
        }
        evt.stopPropagation();
        props.onClose();
      }}
    >
      <box
        width={props.size === 'large' ? 80 : 60}
        maxWidth="95%"
        backgroundColor="#1a1a2e"
        paddingTop={1}
        paddingBottom={1}
        onMouseDown={() => {
          // 标记点击了内容区域
          contentClickRef.current = true;
        }}
        onMouseUp={evt => {
          evt.stopPropagation();
        }}
      >
        {props.children}
      </box>
    </box>
  );
}

export interface DialogProviderProps {
  children: ReactNode;
}

export function DialogProvider(props: DialogProviderProps) {
  const [stack, setStack] = useState<
    Array<{
      element: ReactNode;
      onClose?: () => void;
    }>
  >([]);

  const renderer = useRenderer();
  let focus: { focus(): void; blur(): void; isDestroyed?: boolean } | null = null;

  useKeyboard(evt => {
    if (stack.length === 0) return;
    if (evt.defaultPrevented) return;
    if (evt.name === 'escape' || (evt.ctrl && evt.name === 'c')) {
      const current = stack.at(-1);
      current?.onClose?.();
      setStack([]);
      evt.preventDefault();
      evt.stopPropagation();

      if (focus && !focus.isDestroyed) {
        focus.focus();
      }
    }
  });

  const value = {
    stack,
    clear: () => {
      for (const item of stack) {
        if (item.onClose) item.onClose();
      }
      setStack([]);

      if (focus && !focus.isDestroyed) {
        focus.focus();
      }
    },
    replace: (element: ReactNode, onClose?: () => void) => {
      if (stack.length === 0) {
        focus = renderer.currentFocusedRenderable;
        focus?.blur();
      }

      for (const item of stack) {
        if (item.onClose) item.onClose();
      }

      setStack([
        {
          element,
          ...(onClose !== undefined ? { onClose } : {}),
        },
      ]);
    },
  };

  return (
    <DialogContext.Provider value={value}>
      {props.children}
      {stack.length > 0 && (
        <Dialog onClose={() => value.clear()} size="medium">
          {stack.at(-1)?.element}
        </Dialog>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogContextValue {
  const value = useContext(DialogContext);
  if (!value) {
    throw new Error('useDialog must be used within DialogProvider');
  }
  return value;
}
