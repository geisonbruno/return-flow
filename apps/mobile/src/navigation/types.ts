/**
 * Return Details receives only the return's ID — not the whole
 * `ReturnRecord` object — so the screen always fetches the current,
 * authoritative state from the backend rather than trusting whatever was
 * true at list-render time.
 *
 * <p>`AddReturnPhotos.origin` makes the post-Skip/Finish destination
 * explicit and testable instead of inferred from navigation history:
 * `'created'` is the primary new-return flow (leads to Customer Signature
 * next), `'details'` is the secondary "add more photos later" flow reached
 * from Return Details (leads back there).
 */
export type RootStackParamList = {
  Login: undefined;
  ReturnList: undefined;
  CreateReturn: undefined;
  ReturnDetails: { returnId: string };
  AddReturnPhotos: { returnId: string; origin: 'created' | 'details' };
  CustomerSignature: { returnId: string };
};
