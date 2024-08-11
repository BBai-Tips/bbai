import React from 'react';
import { render } from 'ink';
import MultilineInput from './MultilineInput.tsx';

interface MultilineInputRendererProps {
  onSubmit: (value: string) => void;
  history: string[];
  saveHistory: (value: string) => void;
}

export function renderMultilineInput(props: MultilineInputRendererProps): void {
  render(
    <MultilineInput
      onSubmit={props.onSubmit}
      history={props.history}
      saveHistory={props.saveHistory}
    />
  );
}
