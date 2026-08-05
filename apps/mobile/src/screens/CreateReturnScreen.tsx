import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toSafeErrorMessage } from '../api/problemDetails';
import type { RootStackParamList } from '../navigation/types';
import { REASON_OPTIONS, UNIT_OPTIONS } from '../returns/returnOptions';
import { createReturn } from '../returns/returnService';
import { validateCreateReturnForm } from '../returns/returnValidation';
import type { CreateReturnFormValues } from '../returns/returnValidation';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateReturn'>;

const INITIAL_VALUES: CreateReturnFormValues = {
  customerName: '',
  productName: '',
  reason: null,
  reasonDetails: '',
  quantity: '',
  unit: null,
  observation: '',
};

export default function CreateReturnScreen({ navigation }: Props) {
  const [values, setValues] = useState<CreateReturnFormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<Partial<Record<keyof CreateReturnFormValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectReason = (reason: CreateReturnFormValues['reason']) => {
    setValues((prev) => ({
      ...prev,
      reason,
      // Changing away from OTHER clears reasonDetails so a stale value from
      // a previous selection can never be accidentally submitted.
      reasonDetails: reason === 'OTHER' ? prev.reasonDetails : '',
    }));
  };

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }
    const { errors: validationErrors, payload } = validateCreateReturnForm(values);
    setErrors(validationErrors);
    if (!payload) {
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const created = await createReturn(payload);
      // replace, not navigate: the form is gone from the stack, so back
      // navigation goes to My Returns, not back into a just-submitted (and
      // now pointless) create form. Goes to AddReturnPhotos, not straight to
      // Return Details, so the driver can attach photos immediately —
      // origin: 'created' means Skip/Finish there lead to Customer Signature
      // next, not straight to Return Details (see AddReturnPhotosScreen).
      navigation.replace('AddReturnPhotos', { returnId: created.id, origin: 'created' });
    } catch (error) {
      setSubmitError(toSafeErrorMessage(error, 'Unable to create the return. Please review the information and try again.'));
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.field}>
            <Text style={styles.label}>Customer name</Text>
            <TextInput
              style={styles.input}
              value={values.customerName}
              onChangeText={(text) => setValues((prev) => ({ ...prev, customerName: text }))}
              editable={!submitting}
              accessibilityLabel="Customer name"
              testID="customer-name-input"
            />
            {errors.customerName ? <Text style={styles.fieldError}>{errors.customerName}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Product name</Text>
            <TextInput
              style={styles.input}
              value={values.productName}
              onChangeText={(text) => setValues((prev) => ({ ...prev, productName: text }))}
              editable={!submitting}
              accessibilityLabel="Product name"
              testID="product-name-input"
            />
            {errors.productName ? <Text style={styles.fieldError}>{errors.productName}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Reason</Text>
            <View style={styles.optionList}>
              {REASON_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[styles.optionRow, values.reason === option.value && styles.optionRowSelected]}
                  onPress={() => selectReason(option.value)}
                  disabled={submitting}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: values.reason === option.value }}
                  testID={`reason-option-${option.value}`}
                >
                  <Text style={[styles.optionLabel, values.reason === option.value && styles.optionLabelSelected]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
            {errors.reason ? <Text style={styles.fieldError}>{errors.reason}</Text> : null}
          </View>

          {values.reason === 'OTHER' ? (
            <View style={styles.field}>
              <Text style={styles.label}>Reason details</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={values.reasonDetails}
                onChangeText={(text) => setValues((prev) => ({ ...prev, reasonDetails: text }))}
                multiline
                editable={!submitting}
                accessibilityLabel="Reason details"
                testID="reason-details-input"
              />
              {errors.reasonDetails ? <Text style={styles.fieldError}>{errors.reasonDetails}</Text> : null}
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Quantity</Text>
            <TextInput
              style={styles.input}
              value={values.quantity}
              onChangeText={(text) => setValues((prev) => ({ ...prev, quantity: text }))}
              keyboardType="number-pad"
              editable={!submitting}
              accessibilityLabel="Quantity"
              testID="quantity-input"
            />
            {errors.quantity ? <Text style={styles.fieldError}>{errors.quantity}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Unit</Text>
            <View style={styles.segmented}>
              {UNIT_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[styles.segment, values.unit === option.value && styles.segmentSelected]}
                  onPress={() => setValues((prev) => ({ ...prev, unit: option.value }))}
                  disabled={submitting}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: values.unit === option.value }}
                  testID={`unit-option-${option.value}`}
                >
                  <Text style={[styles.segmentLabel, values.unit === option.value && styles.segmentLabelSelected]}>
                    {option.value} — {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {errors.unit ? <Text style={styles.fieldError}>{errors.unit}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Observation</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={values.observation}
              onChangeText={(text) => setValues((prev) => ({ ...prev, observation: text }))}
              multiline
              editable={!submitting}
              accessibilityLabel="Observation"
              testID="observation-input"
            />
            {errors.observation ? <Text style={styles.fieldError}>{errors.observation}</Text> : null}
          </View>

          {submitError ? (
            <Text style={styles.submitError} accessibilityRole="alert">
              {submitError}
            </Text>
          ) : null}

          <Pressable
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            accessibilityRole="button"
            testID="create-return-submit-button"
          >
            {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitLabel}>Create Return</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 20,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  multilineInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  fieldError: {
    fontSize: 13,
    color: '#B91C1C',
  },
  optionList: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  optionRow: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    minHeight: 48,
    justifyContent: 'center',
  },
  optionRowSelected: {
    backgroundColor: '#EFF6FF',
  },
  optionLabel: {
    fontSize: 15,
    color: '#111827',
  },
  optionLabelSelected: {
    fontWeight: '700',
    color: '#1D4ED8',
  },
  segmented: {
    flexDirection: 'row',
    gap: 10,
  },
  segment: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  segmentSelected: {
    borderColor: '#1D4ED8',
    backgroundColor: '#EFF6FF',
  },
  segmentLabel: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  segmentLabelSelected: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  submitError: {
    fontSize: 14,
    color: '#B91C1C',
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginBottom: 24,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
