import React, { useState, useEffect } from 'react';
import { Alert, StatusBar, useColorScheme } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore'; // 🔹추가
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

// 화면 컴포넌트 임포트
import AuthScreen from './components/Auth';
import StudyTimerScreen from './components/StudyTimer';
import StudyCalendarScreen from './components/StudyCalendar';
import RankingsScreen from './components/Rankings';
import ProfileScreen from './components/Profile';
import StudyGroupsScreen from './components/StudyGroups'; // 그룹 탭
import GroupDetailScreen from './components/groups/GroupDetailScreen'; // 그룹 상세
import NotificationsScreen from './components/Notifications';

// 네비게이터 생성
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// 로그인 후 보여줄 메인 앱 (하단 탭 네비게이터)
function MainAppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName: string = 'help';
          if (route.name === '타이머') iconName = 'timer';
          else if (route.name === '캘린더') iconName = 'event';
          else if (route.name === '그룹') iconName = 'groups';
          else if (route.name === '랭킹') iconName = 'leaderboard';
          else if (route.name === '알림') iconName = 'notifications';
          else if (route.name === '프로필') iconName = 'person';
          return <MaterialIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#FF8F00',
        tabBarInactiveTintColor: 'gray',
        headerShown: true,
      })}
    >
      <Tab.Screen name="타이머" component={StudyTimerScreen} />
      <Tab.Screen name="캘린더" component={StudyCalendarScreen} />
      <Tab.Screen name="그룹" component={StudyGroupsScreen} />
      <Tab.Screen name="랭킹" component={RankingsScreen} />
      <Tab.Screen name="알림" component={NotificationsScreen} />
      <Tab.Screen name="프로필" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// 앱의 전체 네비게이션 플로우
export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const scheme = useColorScheme();

  // Firebase 인증 상태 리스너
  function onAuthStateChanged(user: FirebaseAuthTypes.User | null) {
    setUser(user);
    if (initializing) {
      setInitializing(false);
    }
  }

  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(onAuthStateChanged);
    return subscriber; // 언마운트 시 구독 해제
  }, []);

  if (initializing) {
    return null;
  }

  const AppTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  // onLogin 함수 정의 (Auth 컴포넌트에 전달)
  const handleLogin = (email: string, pass: string) => {
    const trimmedEmail = email.trim();
    const trimmedPass = pass.trim();

    if (!trimmedEmail || !trimmedPass) {
      Alert.alert('오류', '이메일과 비밀번호를 입력해주세요.');
      return;
    }

    auth()
      .signInWithEmailAndPassword(trimmedEmail, trimmedPass)
      .then(userCredential => {
        console.log('로그인 성공:', userCredential.user.email);
      })
      .catch(error => {
        if (error.code === 'auth/user-not-found') {
          Alert.alert('로그인 오류', '존재하지 않는 계정입니다.');
        } else if (error.code === 'auth/wrong-password') {
          Alert.alert('로그인 오류', '비밀번호가 일치하지 않습니다.');
        } else if (error.code === 'auth/invalid-email') {
          Alert.alert('오류', '올바르지 않은 이메일 형식입니다.');
        } else {
          Alert.alert('로그인 오류', '로그인에 실패했습니다. 네트워크 상태를 확인해주세요.');
        }
      });
  };

  const handleSignUp = (email: string, pass: string, passConfirm: string) => {
    const trimmedEmail = email.trim();
    const trimmedPass = pass.trim();
    const trimmedPassConfirm = passConfirm.trim();

    if (!trimmedEmail || !trimmedPass) {
      Alert.alert('오류', '이메일과 비밀번호를 입력해주세요.');
      return;
    }

    if (trimmedPass !== trimmedPassConfirm) {
      Alert.alert('가입 오류', '비밀번호가 일치하지 않습니다.');
      return;
    }

    auth()
      .createUserWithEmailAndPassword(trimmedEmail, trimmedPass)
      .then(userCredential => {
        console.log('회원가입 성공:', userCredential.user.email);
        Alert.alert('환영합니다!', '회원가입이 완료되어 자동으로 로그인되었습니다.');

        const { uid, email: userEmail } = userCredential.user;
        firestore().collection('users').doc(uid).set({
          email: userEmail,
          displayName: userEmail?.split('@')[0],
          createdAt: firestore.FieldValue.serverTimestamp(),
          subjects: ['수학', '영어', '코딩', '과학', '기타'],
          pomodoroSettings: {
            focus: 25,
            shortBreak: 5,
            longBreak: 15,
          },
        });
      })
      .catch(error => {
        if (error.code === 'auth/email-already-in-use') {
          Alert.alert('가입 오류', '이미 사용 중인 이메일입니다.');
        } else if (error.code === 'auth/invalid-email') {
          Alert.alert('가입 오류', '올바르지 않은 이메일 형식입니다.');
        } else if (error.code === 'auth/weak-password') {
          Alert.alert('가입 오류', '비밀번호는 6자 이상이어야 합니다.');
        } else {
          Alert.alert('가입 오류', '알 수 없는 오류로 가입에 실패했습니다.');
        }
      });
  };

  return (
    <NavigationContainer theme={AppTheme}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="MainApp" component={MainAppTabs} />
            <Stack.Screen
              name="GroupDetail"
              component={GroupDetailScreen}
              options={{ headerShown: true, title: '그룹 상세' }}
            />
          </>
        ) : (
          <Stack.Screen name="Auth">
            {() => <AuthScreen onLogin={handleLogin} onSignUp={handleSignUp} />}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
