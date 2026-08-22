import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, toSafeErrorMessage } from '../api/problemDetails';
import type { SignaturePadHandle } from '../components/SignaturePad';
import SignaturePad from '../components/SignaturePad';
import ErrorMessage from '../components/ErrorMessage';
import LoadingView from '../components/LoadingView';
import type { RootStackParamList } from '../navigation/types';
import { formatQuantityAndUnit, REASON_LABELS } from '../returns/returnOptions';
import { createReturnSignature, getReturn } from '../returns/returnService';
import { hasMeaningfulSignature, validateSignerName } from '../returns/signatureValidation';
import type { ReturnRecord, SignatureStroke } from '../returns/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerSignature'>;

type ScreenState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; record: ReturnRecord };

export default function CustomerSignatureScreen({ navigation, route }: Props) {
  const { returnId } = route.params;
  const [state, setState] = useState<ScreenState>({ status: 'loading' });
  const [signerName, setSignerName] = useState('');
  const [strokes, setStrokes] = useState<SignatureStroke[]>([]);
  const [signerNameError, setSignerNameError] = useState<string | undefined>(undefined);
  const [signatureError, setSignatureError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  /**
   * True only while a finger/pointer is actively drawing inside the pad.
   * Everything on this screen still scrolls normally before and after a
   * stroke — smaller devices need that — but a drag inside the pad must draw
   * rather than move the page under the customer's hand. `SignaturePad`
   * reports `false` again on release *and* on gesture termination, so an
   * interrupted gesture can never leave scrolling permanently disabled.
   */
  const [drawing, setDrawing] = useState(false);
  const padRef = useRef<SignaturePadHandle>(null);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const record = await getReturn(returnId);
      setState({ status: 'ready', record });
    } catch (error) {
      setState({ status: 'error', message: toSafeErrorMessage(error, 'Unable to load this return.') });
    }
  }, [returnId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const goToDetails = useCallback(() => {
    navigation.replace('ReturnDetails', { returnId });
  }, [navigation, returnId]);

  const handleClear = useCallback(() => {
    padRef.current?.clear();
    setStrokes([]);
    setSignatureError(undefined);
  }, []);

  const handleUndo = useCallback(() => {
    padRef.current?.undoLast();
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitting) {
      // Guards against a fast double-tap starting a second request before
      // the first one has a chance to disable the button via state.
      return;
    }
    const nameError = validateSignerName(signerName);
    const strokesValid = hasMeaningfulSignature(strokes);
    setSignerNameError(nameError);
    setSignatureError(strokesValid ? undefined : 'Please draw the customer signature before submitting.');
    if (nameError || !strokesValid) {
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      await createReturnSignature(returnId, { signerName: signerName.trim(), strokes });
      goToDetails();
    } catch (error) {
      // A 409 here means the return already has a signature — most likely a
      // duplicate submission that the app's own guard should have prevented,
      // but if it still happens (e.g. a retried request after a dropped
      // response) the safe outcome is the same one as success: the return is
      // signed, so move on rather than showing a confusing error.
      if (error instanceof ApiError && error.status === 409) {
        goToDetails();
        return;
      }
      setSubmitError(toSafeErrorMessage(error, 'Unable to submit the signature. Please try again.'));
      setSubmitting(false);
    }
  }, [goToDetails, returnId, signerName, strokes, submitting]);

  if (state.status === 'loading') {
    return <LoadingView label="Loading return…" />;
  }

  if (state.status === 'error') {
    return <ErrorMessage message={state.message} onRetry={() => void load()} />;
  }

  const { record } = state;

  if (record.signature) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.centered}>
          <Text style={styles.capturedTitle}>Signature already captured</Text>
          <Text style={styles.capturedSubtitle}>
            {record.signature.signerName} signed this return. A return can only have one customer signature.
          </Text>
          <Pressable style={styles.primaryButton} onPress={goToDetails} accessibilityRole="button" testID="go-to-details-button">
            <Text style={styles.primaryButtonLabel}>Go to Return Details</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const submitDisabled = submitting;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!drawing}
        testID="signature-scroll"
      >
        <Text style={styles.subtitle}>Ask the customer to review and sign below to complete this return.</Text>

        <View style={styles.summaryCard}>
          <SummaryRow label="Return" value={record.returnNumber} />
          <SummaryRow label="Customer" value={record.customerName} />
          <SummaryRow label="Product" value={record.productName} />
          <SummaryRow label="Quantity" value={formatQuantityAndUnit(record.quantity, record.unit)} />
          <SummaryRow label="Reason" value={REASON_LABELS[record.reason]} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Customer representative name</Text>
          <TextInput
            style={styles.input}
            value={signerName}
            onChangeText={(text) => {
              setSignerName(text);
              if (signerNameError) {
                setSignerNameError(undefined);
              }
            }}
            editable={!submitting}
            accessibilityLabel="Customer representative name"
            testID="signer-name-input"
          />
          {signerNameError ? <Text style={styles.fieldError}>{signerNameError}</Text> : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Customer signature</Text>
          <SignaturePad
            ref={padRef}
            testID="signature-pad"
            onDrawingActiveChange={setDrawing}
            onStrokesChange={(next) => {
              setStrokes(next);
              if (signatureError) {
                setSignatureError(undefined);
              }
            }}
          />
          {signatureError ? <Text style={styles.fieldError}>{signatureError}</Text> : null}

          <View style={styles.padActions}>
            <Pressable onPress={handleUndo} disabled={submitting} accessibilityRole="button" testID="undo-button">
              <Text style={styles.padActionLabel}>Undo</Text>
            </Pressable>
            <Pressable onPress={handleClear} disabled={submitting} accessibilityRole="button" testID="clear-button">
              <Text style={styles.padActionLabel}>Clear</Text>
            </Pressable>
          </View>
        </View>

        {submitError ? (
          <Text style={styles.submitError} accessibilityRole="alert">
            {submitError}
          </Text>
        ) : null}

        <Pressable
          style={[styles.primaryButton, submitDisabled && styles.primaryButtonDisabled]}
          onPress={() => void handleSubmit()}
          disabled={submitDisabled}
          accessibilityRole="button"
          testID="submit-signature-button"
        >
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonLabel}>Submit signature</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  capturedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  capturedSubtitle: {
    fontSize: 15,
    color: '#4B5563',
    textAlign: 'center',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  subtitle: {
    fontSize: 15,
    color: '#374151',
  },
  summaryCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 13,
    color: '#111827',
    flexShrink: 1,
    textAlign: 'right',
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
  fieldError: {
    fontSize: 13,
    color: '#B91C1C',
  },
  padActions: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 4,
  },
  padActionLabel: {
    color: '#2563EB',
    fontWeight: '600',
    fontSize: 14,
  },
  submitError: {
    fontSize: 14,
    color: '#B91C1C',
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginBottom: 24,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
