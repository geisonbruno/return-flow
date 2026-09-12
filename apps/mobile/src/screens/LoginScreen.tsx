import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { DRIVER_ONLY_MESSAGE, useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { colors as palette } from '../theme/tokens';

export default function LoginScreen() {
  const { login, sessionMessage } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof Error && err.message === DRIVER_ONLY_MESSAGE) {
        setError(DRIVER_ONLY_MESSAGE);
      } else {
        setError(toSafeErrorMessage(err, 'Unable to sign in. Check your email and password.'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const revealLabel = showPassword ? 'Hide password' : 'Show password';

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Purely decorative ambient corners — the phone-scale counterpart of the
          approved Web Login's green corner treatment. Concentric translucent
          circles stand in for a radial gradient, which React Native cannot
          express without pulling in a gradient library. */}
      <View style={[styles.ambient, styles.ambientTop]} pointerEvents="none" />
      <View style={[styles.ambient, styles.ambientTopInner]} pointerEvents="none" />
      <View style={[styles.ambient, styles.ambientBottom]} pointerEvents="none" />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Icon name="brand" size={34} color={palette.green} />
            <Text style={styles.wordmark}>ReturnFlow</Text>
          </View>

          <Text style={styles.heading}>Driver sign in</Text>
          <Text style={styles.supporting}>Sign in to your account to manage returns on the go.</Text>

          {sessionMessage ? (
            <Text style={styles.sessionMessage} accessibilityRole="alert">
              {sessionMessage}
            </Text>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrap}>
              <View style={styles.inputIcon} pointerEvents="none">
                <Icon name="mail" size={20} color={palette.muted} />
              </View>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                editable={!submitting}
                accessibilityLabel="Email"
                testID="login-email-input"
                placeholder="Enter your email"
                placeholderTextColor={palette.muted}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                submitBehavior="submit"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <View style={styles.inputIcon} pointerEvents="none">
                <Icon name="lock" size={20} color={palette.muted} />
              </View>
              <TextInput
                ref={passwordRef}
                style={[styles.input, styles.inputWithReveal]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                editable={!submitting}
                accessibilityLabel="Password"
                testID="login-password-input"
                placeholder="Enter your password"
                placeholderTextColor={palette.muted}
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
              />
              {/* A reveal control only: it flips `secureTextEntry` and never
                  touches the entered value or submits the form. */}
              <Pressable
                style={styles.reveal}
                onPress={() => setShowPassword((visible) => !visible)}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel={revealLabel}
                accessibilityState={{ disabled: submitting, selected: showPassword }}
                hitSlop={8}
                testID="login-password-reveal"
              >
                <Icon name={showPassword ? 'eye-off' : 'eye'} size={20} color={palette.muted} />
              </Pressable>
            </View>
          </View>

          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Pressable
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            accessibilityRole="button"
            testID="login-submit-button"
          >
            {submitting ? (
              <ActivityIndicator color={palette.page} />
            ) : (
              <Text style={styles.buttonLabel}>Sign in</Text>
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
    backgroundColor: palette.page,
  },
  flex: {
    flex: 1,
  },
  ambient: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: palette.ambient,
    borderWidth: 1,
    borderColor: palette.ambientEdge,
  },
  ambientTop: {
    width: 420,
    height: 420,
    top: -215,
    left: -175,
  },
  ambientTopInner: {
    width: 250,
    height: 250,
    top: -130,
    left: -90,
  },
  ambientBottom: {
    width: 380,
    height: 380,
    right: -190,
    bottom: -205,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    // Biased toward the upper-middle of the screen rather than dead centre, so
    // the composition still reads well once the keyboard takes the lower half.
    paddingTop: 24,
    paddingBottom: 72,
    gap: 14,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  wordmark: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: palette.text,
  },
  heading: {
    marginTop: 10,
    fontSize: 21,
    fontWeight: '700',
    textAlign: 'center',
    color: palette.text,
  },
  supporting: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: palette.muted,
    marginBottom: 6,
  },
  sessionMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: palette.warning,
    backgroundColor: palette.warningSurface,
    borderWidth: 1,
    borderColor: palette.warningBorder,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  field: {
    gap: 7,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
  },
  inputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 14,
    zIndex: 1,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    backgroundColor: palette.surfaceRaised,
    paddingLeft: 44,
    paddingRight: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: palette.text,
  },
  inputWithReveal: {
    paddingRight: 52,
  },
  reveal: {
    position: 'absolute',
    right: 6,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    color: palette.danger,
    backgroundColor: palette.dangerSurface,
    borderWidth: 1,
    borderColor: palette.dangerBorder,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  button: {
    backgroundColor: palette.green,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    minHeight: 52,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonLabel: {
    color: palette.page,
    fontSize: 16,
    fontWeight: '700',
  },
});
