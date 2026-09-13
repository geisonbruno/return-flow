import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toSafeErrorMessage } from '../api/problemDetails';
import { Icon } from '../components/Icon';
import StepIndicator from '../components/StepIndicator';
import type { RootStackParamList } from '../navigation/types';
import { REASON_OPTIONS, UNIT_OPTIONS } from '../returns/returnOptions';
import { createReturn } from '../returns/returnService';
import { validateCreateReturnForm } from '../returns/returnValidation';
import type { CreateReturnFormValues } from '../returns/returnValidation';
import { colors, radius, spacing } from '../theme/tokens';

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

interface SelectOption<T extends string> {
  value: T;
  label: string;
}

/**
 * A compact selector that opens its options in a sheet rather than keeping the
 * whole list permanently expanded — the reason list alone is eleven entries,
 * which would dominate the form. Built on React Native's own `Modal`, so no
 * select library is introduced.
 *
 * <p>Each option keeps the `testID` and radio semantics the list rows already
 * had, so what is asserted about selection behaviour is unchanged; only the
 * moment the options become visible differs.
 */
function SelectField<T extends string>({
  label,
  placeholder,
  options,
  value,
  onSelect,
  disabled,
  testIDPrefix,
  error,
  style,
}: {
  label: string;
  placeholder: string;
  options: readonly SelectOption<T>[];
  value: T | null;
  onSelect: (value: T) => void;
  disabled?: boolean;
  testIDPrefix: string;
  error?: string;
  style?: object;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={styles.select}
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: selected ? selected.label : placeholder }}
        testID={`${testIDPrefix}-select`}
      >
        <Text style={[styles.selectValue, !selected && styles.selectPlaceholder]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Icon name="chevron-right" size={16} color={colors.muted} />
      </Pressable>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setOpen(false)} accessibilityLabel={`Close ${label}`}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle} accessibilityRole="header">
              {label}
            </Text>
            <ScrollView>
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                    onPress={() => {
                      onSelect(option.value);
                      setOpen(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    testID={`${testIDPrefix}-option-${option.value}`}
                  >
                    <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>{option.label}</Text>
                    {isSelected ? <Text style={styles.optionCheck}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

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
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          style={styles.back}
          onPress={() => navigation.goBack()}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          testID="create-return-back-button"
        >
          <Icon name="chevron-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          New Return
        </Text>
        {/* Balances the back control so the title stays centred. */}
        <View style={styles.back} />
      </View>

      {/* Step 1 of the guided flow. The indicator reflects this screen; the
          navigation stack remains the source of truth for where the driver is. */}
      <StepIndicator currentStep={1} />

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
              placeholder="Enter customer name"
              placeholderTextColor={colors.muted}
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
              placeholder="Enter product name"
              placeholderTextColor={colors.muted}
            />
            {errors.productName ? <Text style={styles.fieldError}>{errors.productName}</Text> : null}
          </View>

          <View style={styles.row}>
            <View style={[styles.field, styles.rowItem]}>
              <Text style={styles.label}>Quantity</Text>
              <TextInput
                style={styles.input}
                value={values.quantity}
                onChangeText={(text) => setValues((prev) => ({ ...prev, quantity: text }))}
                keyboardType="number-pad"
                editable={!submitting}
                accessibilityLabel="Quantity"
                testID="quantity-input"
                placeholder="1"
                placeholderTextColor={colors.muted}
              />
              {errors.quantity ? <Text style={styles.fieldError}>{errors.quantity}</Text> : null}
            </View>

            <SelectField
              label="Unit"
              placeholder="Select a unit"
              options={UNIT_OPTIONS.map((option) => ({ value: option.value, label: `${option.value} — ${option.label}` }))}
              value={values.unit}
              onSelect={(unit) => setValues((prev) => ({ ...prev, unit }))}
              disabled={submitting}
              testIDPrefix="unit"
              error={errors.unit}
              style={styles.rowItem}
            />
          </View>

          <SelectField
            label="Reason"
            placeholder="Select a reason"
            options={REASON_OPTIONS}
            value={values.reason}
            onSelect={selectReason}
            disabled={submitting}
            testIDPrefix="reason"
            error={errors.reason}
          />

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
                placeholder="Describe the reason"
                placeholderTextColor={colors.muted}
              />
              {errors.reasonDetails ? <Text style={styles.fieldError}>{errors.reasonDetails}</Text> : null}
            </View>
          ) : null}

          <View style={styles.field}>
            {/* Not labelled "optional": the backend requires a non-blank
                observation (`CreateReturnRequest` marks it `@NotBlank`) and the
                existing client validation enforces the same rule. */}
            <Text style={styles.label}>Observation</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={values.observation}
              onChangeText={(text) => setValues((prev) => ({ ...prev, observation: text }))}
              multiline
              editable={!submitting}
              accessibilityLabel="Observation"
              testID="observation-input"
              placeholder="Add any additional notes..."
              placeholderTextColor={colors.muted}
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
            accessibilityLabel="Continue"
            testID="create-return-submit-button"
          >
            {submitting ? (
              <ActivityIndicator color={colors.page} />
            ) : (
              <Text style={styles.submitLabel}>Continue</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.page,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rowItem: {
    flex: 1,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  multilineInput: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
  },
  selectValue: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  selectPlaceholder: {
    color: colors.muted,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(4, 8, 11, 0.72)',
  },
  sheet: {
    maxHeight: '70%',
    borderTopLeftRadius: radius.lg + 4,
    borderTopRightRadius: radius.lg + 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  optionRowSelected: {
    backgroundColor: colors.surfaceRaised,
  },
  optionLabel: {
    fontSize: 15,
    color: colors.text,
  },
  optionLabelSelected: {
    fontWeight: '700',
    color: colors.green,
  },
  optionCheck: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.green,
  },
  fieldError: {
    fontSize: 13,
    color: colors.danger,
  },
  submitError: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.danger,
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
  },
  submitButton: {
    backgroundColor: colors.green,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 3,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitLabel: {
    color: colors.page,
    fontSize: 16,
    fontWeight: '700',
  },
});
