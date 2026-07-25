import { render, screen } from '@testing-library/react-native';
import PlaceholderScreen from './PlaceholderScreen';

describe('PlaceholderScreen', () => {
  it('renders the ReturnFlow placeholder', () => {
    render(<PlaceholderScreen />);
    expect(screen.getByText('ReturnFlow')).toBeTruthy();
  });
});
