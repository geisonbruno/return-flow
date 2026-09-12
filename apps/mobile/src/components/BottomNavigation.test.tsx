import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import BottomNavigation from './BottomNavigation';

function buildNavigation() {
  return { navigate: jest.fn() };
}

describe('BottomNavigation', () => {
  it('marks Returns as the selected item on My Returns, and nothing else', () => {
    render(<BottomNavigation active="returns" navigation={buildNavigation() as never} />);

    expect(screen.getByTestId('bottom-nav-returns').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('bottom-nav-profile').props.accessibilityState.selected).toBe(false);
    // New Return is an action into the creation flow, never a selected destination.
    expect(screen.getByTestId('bottom-nav-new-return').props.accessibilityState.selected).toBe(false);
  });

  it('marks Profile as the selected item on Profile', () => {
    render(<BottomNavigation active="profile" navigation={buildNavigation() as never} />);

    expect(screen.getByTestId('bottom-nav-profile').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('bottom-nav-returns').props.accessibilityState.selected).toBe(false);
  });

  it('exposes a text label and an accessible name for every item, never an icon alone', () => {
    render(<BottomNavigation active="returns" navigation={buildNavigation() as never} />);

    for (const label of ['Returns', 'New Return', 'Profile']) {
      expect(screen.getByText(label)).toBeTruthy();
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });

  it('navigates to the existing routes, without duplicating any of them', () => {
    const navigation = buildNavigation();
    render(<BottomNavigation active="profile" navigation={navigation as never} />);

    fireEvent.press(screen.getByTestId('bottom-nav-returns'));
    expect(navigation.navigate).toHaveBeenCalledWith('ReturnList');

    fireEvent.press(screen.getByTestId('bottom-nav-new-return'));
    expect(navigation.navigate).toHaveBeenCalledWith('CreateReturn');

    fireEvent.press(screen.getByTestId('bottom-nav-profile'));
    expect(navigation.navigate).toHaveBeenCalledWith('Profile');

    expect(navigation.navigate).toHaveBeenCalledTimes(3);
  });
});
