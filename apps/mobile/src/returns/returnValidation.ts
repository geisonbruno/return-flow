import type { CreateReturnPayload, ReturnReason, ReturnUnit } from './types';

/** Mirrors `returnrecord.ReturnRecordCreator`'s limits exactly — the backend remains the final source of truth. */
export const CUSTOMER_NAME_MAX_LENGTH = 200;
export const PRODUCT_NAME_MAX_LENGTH = 200;
export const OBSERVATION_MAX_LENGTH = 2000;
export const REASON_DETAILS_MAX_LENGTH = 500;

export interface CreateReturnFormValues {
  customerName: string;
  productName: string;
  reason: ReturnReason | null;
  reasonDetails: string;
  /** Raw text from the numeric input — validated and parsed here, never trusted as-is. */
  quantity: string;
  unit: ReturnUnit | null;
  observation: string;
}

export interface CreateReturnFormErrors {
  customerName?: string;
  productName?: string;
  reason?: string;
  reasonDetails?: string;
  quantity?: string;
  unit?: string;
  observation?: string;
}

export interface CreateReturnValidationResult {
  errors: CreateReturnFormErrors;
  /** Non-null only when there are zero errors — the exact backend request payload. */
  payload: CreateReturnPayload | null;
}

const WHOLE_NUMBER_PATTERN = /^\d+$/;

export function validateCreateReturnForm(values: CreateReturnFormValues): CreateReturnValidationResult {
  const errors: CreateReturnFormErrors = {};

  const customerName = values.customerName.trim();
  if (!customerName) {
    errors.customerName = 'Customer name is required.';
  } else if (customerName.length > CUSTOMER_NAME_MAX_LENGTH) {
    errors.customerName = `Customer name must be ${CUSTOMER_NAME_MAX_LENGTH} characters or fewer.`;
  }

  const productName = values.productName.trim();
  if (!productName) {
    errors.productName = 'Product name is required.';
  } else if (productName.length > PRODUCT_NAME_MAX_LENGTH) {
    errors.productName = `Product name must be ${PRODUCT_NAME_MAX_LENGTH} characters or fewer.`;
  }

  if (!values.reason) {
    errors.reason = 'Reason is required.';
  }

  let reasonDetails: string | undefined;
  if (values.reason === 'OTHER') {
    const trimmedDetails = values.reasonDetails.trim();
    if (!trimmedDetails) {
      errors.reasonDetails = 'Reason details are required when reason is Other.';
    } else if (trimmedDetails.length > REASON_DETAILS_MAX_LENGTH) {
      errors.reasonDetails = `Reason details must be ${REASON_DETAILS_MAX_LENGTH} characters or fewer.`;
    } else {
      reasonDetails = trimmedDetails;
    }
  }

  const quantityText = values.quantity.trim();
  let quantity: number | undefined;
  if (!quantityText) {
    errors.quantity = 'Quantity is required.';
  } else if (!WHOLE_NUMBER_PATTERN.test(quantityText)) {
    errors.quantity = 'Quantity must be a positive whole number.';
  } else if (Number(quantityText) === 0) {
    errors.quantity = 'Quantity must be greater than zero.';
  } else {
    quantity = Number(quantityText);
  }

  if (!values.unit) {
    errors.unit = 'Unit is required.';
  }

  const observation = values.observation.trim();
  if (!observation) {
    errors.observation = 'Observation is required.';
  } else if (observation.length > OBSERVATION_MAX_LENGTH) {
    errors.observation = `Observation must be ${OBSERVATION_MAX_LENGTH} characters or fewer.`;
  }

  if (Object.keys(errors).length > 0 || !values.reason || !values.unit || quantity === undefined) {
    return { errors, payload: null };
  }

  const payload: CreateReturnPayload = {
    customerName,
    productName,
    reason: values.reason,
    quantity,
    unit: values.unit,
    observation,
  };
  if (values.reason === 'OTHER' && reasonDetails) {
    payload.reasonDetails = reasonDetails;
  }

  return { errors, payload };
}
