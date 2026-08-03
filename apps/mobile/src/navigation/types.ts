/**
 * Return Details receives only the return's ID — not the whole
 * `ReturnRecord` object — so the screen always fetches the current,
 * authoritative state from the backend rather than trusting whatever was
 * true at list-render time.
 */
export type RootStackParamList = {
  Login: undefined;
  ReturnList: undefined;
  CreateReturn: undefined;
  ReturnDetails: { returnId: string };
  AddReturnPhotos: { returnId: string };
};
