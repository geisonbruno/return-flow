import { render, screen } from '@testing-library/react-native';
import React from 'react';

import StepIndicator, { RETURN_FLOW_STEPS } from './StepIndicator';

describe('StepIndicator', () => {
  it('renders exactly the four flow steps, in order', () => {
    render(<StepIndicator currentStep={1} />);

    expect(RETURN_FLOW_STEPS).toEqual(['Details', 'Photos', 'Signature', 'Review']);
    for (const label of RETURN_FLOW_STEPS) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByTestId('step-4')).toBeTruthy();
    expect(screen.queryByTestId('step-5')).toBeNull();
  });

  it('marks only the current step as selected', () => {
    render(<StepIndicator currentStep={1} />);

    expect(screen.getByTestId('step-1').props.accessibilityState.selected).toBe(true);
    for (const position of [2, 3, 4]) {
      expect(screen.getByTestId(`step-${position}`).props.accessibilityState.selected).toBe(false);
    }
  });

  it('announces each step position and state, so state is never colour alone', () => {
    render(<StepIndicator currentStep={3} />);

    expect(screen.getByLabelText('Step 1 of 4, Details, completed')).toBeTruthy();
    expect(screen.getByLabelText('Step 2 of 4, Photos, completed')).toBeTruthy();
    expect(screen.getByLabelText('Step 3 of 4, Signature, current')).toBeTruthy();
    expect(screen.getByLabelText('Step 4 of 4, Review, upcoming')).toBeTruthy();
  });

  it('is reusable for every screen in the flow', () => {
    // The component reflects whichever step its screen represents; it holds no
    // state of its own, so the navigation stack stays the source of truth.
    for (const current of [1, 2, 3, 4]) {
      const view = render(<StepIndicator currentStep={current} />);
      expect(screen.getByTestId(`step-${current}`).props.accessibilityState.selected).toBe(true);
      view.unmount();
    }
  });
});
