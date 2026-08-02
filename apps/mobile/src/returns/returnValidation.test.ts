import {
  CUSTOMER_NAME_MAX_LENGTH,
  OBSERVATION_MAX_LENGTH,
  PRODUCT_NAME_MAX_LENGTH,
  REASON_DETAILS_MAX_LENGTH,
  validateCreateReturnForm,
} from './returnValidation';
import type { CreateReturnFormValues } from './returnValidation';

const VALID: CreateReturnFormValues = {
  customerName: 'Market ABC',
  productName: 'Widget X200',
  reason: 'DAMAGED',
  reasonDetails: '',
  quantity: '3',
  unit: 'CTN',
  observation: 'Box was open on arrival',
};

describe('validateCreateReturnForm', () => {
  it('accepts a fully valid form and produces the exact backend payload', () => {
    const { errors, payload } = validateCreateReturnForm(VALID);

    expect(errors).toEqual({});
    expect(payload).toEqual({
      customerName: 'Market ABC',
      productName: 'Widget X200',
      reason: 'DAMAGED',
      quantity: 3,
      unit: 'CTN',
      observation: 'Box was open on arrival',
    });
    expect(payload).not.toHaveProperty('reasonDetails');
  });

  it('trims customer name, product name, observation, and reason details', () => {
    const { payload } = validateCreateReturnForm({
      ...VALID,
      customerName: '  Market ABC  ',
      productName: '  Widget X200  ',
      observation: '  Box was open on arrival  ',
      reason: 'OTHER',
      reasonDetails: '  Customer changed their mind  ',
    });

    expect(payload?.customerName).toBe('Market ABC');
    expect(payload?.productName).toBe('Widget X200');
    expect(payload?.observation).toBe('Box was open on arrival');
    expect(payload?.reasonDetails).toBe('Customer changed their mind');
  });

  it('requires customer name', () => {
    const { errors, payload } = validateCreateReturnForm({ ...VALID, customerName: '   ' });
    expect(errors.customerName).toBeDefined();
    expect(payload).toBeNull();
  });

  it('rejects a customer name over the backend maximum length', () => {
    const { errors } = validateCreateReturnForm({ ...VALID, customerName: 'A'.repeat(CUSTOMER_NAME_MAX_LENGTH + 1) });
    expect(errors.customerName).toBeDefined();
  });

  it('requires product name', () => {
    const { errors, payload } = validateCreateReturnForm({ ...VALID, productName: '   ' });
    expect(errors.productName).toBeDefined();
    expect(payload).toBeNull();
  });

  it('rejects a product name over the backend maximum length', () => {
    const { errors } = validateCreateReturnForm({ ...VALID, productName: 'A'.repeat(PRODUCT_NAME_MAX_LENGTH + 1) });
    expect(errors.productName).toBeDefined();
  });

  it('keeps product name separate from observation in the built payload', () => {
    const { payload } = validateCreateReturnForm({ ...VALID, productName: 'Widget X200', observation: 'Box was damp' });
    expect(payload?.productName).toBe('Widget X200');
    expect(payload?.observation).toBe('Box was damp');
    expect(payload?.observation).not.toContain('Widget X200');
  });

  it('requires a reason', () => {
    const { errors, payload } = validateCreateReturnForm({ ...VALID, reason: null });
    expect(errors.reason).toBeDefined();
    expect(payload).toBeNull();
  });

  it('requires non-blank reasonDetails when reason is OTHER', () => {
    const { errors, payload } = validateCreateReturnForm({ ...VALID, reason: 'OTHER', reasonDetails: '   ' });
    expect(errors.reasonDetails).toBeDefined();
    expect(payload).toBeNull();
  });

  it('rejects reasonDetails over the backend maximum length', () => {
    const { errors } = validateCreateReturnForm({
      ...VALID,
      reason: 'OTHER',
      reasonDetails: 'A'.repeat(REASON_DETAILS_MAX_LENGTH + 1),
    });
    expect(errors.reasonDetails).toBeDefined();
  });

  it('never includes reasonDetails in the payload for a non-OTHER reason, even if the field still holds stale text', () => {
    const { payload } = validateCreateReturnForm({ ...VALID, reason: 'DAMAGED', reasonDetails: 'leftover text' });
    expect(payload).not.toBeNull();
    expect(payload).not.toHaveProperty('reasonDetails');
  });

  it('requires quantity', () => {
    const { errors, payload } = validateCreateReturnForm({ ...VALID, quantity: '' });
    expect(errors.quantity).toBeDefined();
    expect(payload).toBeNull();
  });

  it('rejects a zero quantity', () => {
    const { errors, payload } = validateCreateReturnForm({ ...VALID, quantity: '0' });
    expect(errors.quantity).toBeDefined();
    expect(payload).toBeNull();
  });

  it('rejects a negative quantity', () => {
    const { errors, payload } = validateCreateReturnForm({ ...VALID, quantity: '-3' });
    expect(errors.quantity).toBeDefined();
    expect(payload).toBeNull();
  });

  it('rejects a decimal quantity', () => {
    const { errors, payload } = validateCreateReturnForm({ ...VALID, quantity: '2.5' });
    expect(errors.quantity).toBeDefined();
    expect(payload).toBeNull();
  });

  it('rejects non-numeric quantity text without silently converting it', () => {
    const { errors, payload } = validateCreateReturnForm({ ...VALID, quantity: 'abc' });
    expect(errors.quantity).toBeDefined();
    expect(payload).toBeNull();
  });

  it('accepts a valid positive integer quantity as a number, not a string', () => {
    const { payload } = validateCreateReturnForm({ ...VALID, quantity: '12' });
    expect(payload?.quantity).toBe(12);
    expect(typeof payload?.quantity).toBe('number');
  });

  it('requires a unit', () => {
    const { errors, payload } = validateCreateReturnForm({ ...VALID, unit: null });
    expect(errors.unit).toBeDefined();
    expect(payload).toBeNull();
  });

  it('accepts CTN and EA as the only units', () => {
    expect(validateCreateReturnForm({ ...VALID, unit: 'CTN' }).payload?.unit).toBe('CTN');
    expect(validateCreateReturnForm({ ...VALID, unit: 'EA' }).payload?.unit).toBe('EA');
  });

  it('requires observation', () => {
    const { errors, payload } = validateCreateReturnForm({ ...VALID, observation: '   ' });
    expect(errors.observation).toBeDefined();
    expect(payload).toBeNull();
  });

  it('rejects observation over the backend maximum length', () => {
    const { errors } = validateCreateReturnForm({ ...VALID, observation: 'A'.repeat(OBSERVATION_MAX_LENGTH + 1) });
    expect(errors.observation).toBeDefined();
  });
});
