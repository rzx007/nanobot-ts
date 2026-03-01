import type { ReactNode } from 'react';
import { theme } from '../theme';
import { logo, marks } from '../constants';

const SHADOW_MARKER = new RegExp(`[${marks}]`);

/** 阴影色：用于 _^~ 的 shadow，与 opencode tint(background, fg, 0.25) 近似 */
const shadowColor = theme.border;

function renderLine(
  line: string,
  fg: string,
  bold: boolean,
): ReactNode[] {
  const elements: ReactNode[] = [];
  let i = 0;

  while (i < line.length) {
    const rest = line.slice(i);
    const markerIndex = rest.search(SHADOW_MARKER);

    if (markerIndex === -1) {
      elements.push(
        <text key={i} fg={fg}>
          {rest}
        </text>,
      );
      break;
    }

    if (markerIndex > 0) {
      elements.push(
        <text key={i} fg={fg}>
          {rest.slice(0, markerIndex)}
        </text>,
      );
    }

    const marker = rest[markerIndex];
    const key = `${i}-${marker}`;
    switch (marker) {
      case '_':
        elements.push(
          <text key={key} fg={fg} bg={shadowColor}>
            {' '}
          </text>,
        );
        break;
      case '^':
        elements.push(
          <text key={key} fg={fg} bg={shadowColor}>
            ▀
          </text>,
        );
        break;
      case '~':
        elements.push(
          <text key={key} fg={shadowColor}>
            ▀
          </text>,
        );
        break;
    }

    i += markerIndex + 1;
  }

  return elements;
}

export function Logo() {
  return (
    <box>
      {logo.left.map((leftLine, index) => (
        <box key={index} flexDirection="row" gap={1}>
          <box flexDirection="row">{renderLine(leftLine, theme.textMuted, false)}</box>
          <box flexDirection="row">
            {/* 添加非空检查 */}
            {logo.right[index] && renderLine(logo.right[index], theme.text, true)}
          </box>
        </box>
      ))}
    </box>
  );
}
