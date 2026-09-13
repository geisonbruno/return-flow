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
  Profile: undefined;
  CreateReturn: undefined;
  /**
   * `origin: 'created'` marks the one arrival that completes the guided
   * new-return flow, so Return Details can present itself as Step 4 of
   * that flow. Every other arrival — a row in My Returns, or finishing the
   * add-more-photos-later flow — omits it and gets the plain details view.
   * It only chooses a presentation; no workflow state is carried or kept.
   */
  ReturnDetails: { returnId: string; origin?: 'created' };
  AddReturnPhotos: { returnId: string; origin: 'created' | 'details' };
  CustomerSignature: { returnId: string };
};
