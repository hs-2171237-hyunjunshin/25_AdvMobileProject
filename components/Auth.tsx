import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';

// Props 타입 정의 수정: onSignUp 추가
interface AuthProps {
  onLogin: (email: string, pass: string) => void;
  onSignUp: (email: string, pass: string, passConfirm: string) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin, onSignUp }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState(''); // 비밀번호 확인 상태 추가
  const [isLoginMode, setIsLoginMode] = useState(true);

  // 모드 전환 함수
  const toggleMode = () => {
      setIsLoginMode(!isLoginMode);
      // 모드 전환 시 입력 필드 초기화
      setEmail('');
      setPassword('');
      setPasswordConfirm('');
    };

  // 제출 버튼 핸들러
  const handleSubmit = () => {
    if (!email || !password) {
      Alert.alert('오류', '이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }
    // 모드에 따라 적절한 함수 호출
    if (isLoginMode) {
          onLogin(email, password);
    } else {
          onSignUp(email, password, passwordConfirm); // passwordConfirm 전달
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}>
        <View style={styles.innerContainer}>
          <Text style={styles.title}>
            {isLoginMode ? 'StudyMate 로그인' : 'StudyMate 회원가입'}
          </Text>
          <Text style={styles.subtitle}>
            {isLoginMode
              ? '로그인하여 스터디를 시작해보세요!'
              : '새 계정을 만들어 스터디에 참여하세요.'}
          </Text>

          {/* 이메일 입력창 */}
          <TextInput
            style={styles.input}
            placeholder="이메일을 입력하세요"
            placeholderTextColor="#888"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* 비밀번호 입력창 */}
          <TextInput
            style={styles.input}
            placeholder="비밀번호를 입력하세요"
            placeholderTextColor="#888"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {!isLoginMode && (
                      <TextInput
                        style={styles.input}
                        placeholder="비밀번호를 다시 입력하세요"
                        placeholderTextColor="#888"
                        value={passwordConfirm}
                        onChangeText={setPasswordConfirm}
                        secureTextEntry
                      />
                    )}

          {/* 메인 액션 버튼 */}
          <TouchableOpacity style={styles.button} onPress={handleSubmit}>
            <Text style={styles.buttonText}>
              {isLoginMode ? '로그인' : '가입하기'}
            </Text>
          </TouchableOpacity>

          {/* 모드 전환 버튼 */}
          <TouchableOpacity style={styles.toggleButton} onPress={toggleMode}>
            <Text style={styles.toggleButtonText}>
              {isLoginMode
                ? '계정이 없으신가요? 회원가입'
                : '이미 계정이 있으신가요? 로그인'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  innerContainer: {
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1c1e21',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#606770',
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    height: 50,
    backgroundColor: '#fff',
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
    color: '#000',
  },
  button: {
    height: 50,
    backgroundColor: '#FF8F00',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // 새로 추가된 스타일
  toggleButton: {
      padding: 10,
      alignItems: 'center',
  },
  toggleButtonText: {
      color: '#FF8F00',
      fontSize: 15,
      fontWeight: '600',
  },
});

export default Auth;