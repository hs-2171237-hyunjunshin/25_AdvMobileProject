import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  Alert,
  ScrollView,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Svg, { Circle } from 'react-native-svg';

// 타이머 모드 타입 정의
type TimerType = 'stopwatch' | 'pomodoro';
type PomodoroMode = 'focus' | 'shortBreak' | 'longBreak';

// 뽀모도로 기본 설정값 (사용자 설정 가능하도록 확장 가능)
const FOCUS_DURATION = 25 * 60;
const SHORT_BREAK_DURATION = 5 * 60;
const LONG_BREAK_DURATION = 15 * 60;
const POMODOROS_UNTIL_LONG_BREAK = 4;

const StudyTimer: React.FC = () => {
  // --- 공통 상태 ---
  const [timerType, setTimerType] = useState<TimerType>('stopwatch');
  const [isActive, setIsActive] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- 스톱워치 상태 ---
  const [stopwatchTime, setStopwatchTime] = useState(0);

  // --- 뽀모도로 상태 ---
  const [pomodoroMode, setPomodoroMode] = useState<PomodoroMode>('focus');
  const [pomodoroTimeLeft, setPomodoroTimeLeft] = useState(FOCUS_DURATION);
  const [pomodoroCycle, setPomodoroCycle] = useState(0); // 완료한 뽀모도로 사이클 수

  // --- 타이머 로직 (Core) ---
  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(() => {
        if (timerType === 'stopwatch') {
          setStopwatchTime(prev => prev + 1);
        } else { // pomodoro
          setPomodoroTimeLeft(prev => {
            if (prev > 1) {
              return prev - 1;
            }
            handlePomodoroEnd();
            return 0;
          });
        }
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, timerType]);

  // --- 모드 및 상태 변경 핸들러 ---
  const changeTimerType = (type: TimerType) => {
    if (isActive) {
        Alert.alert('알림', '타이머가 실행 중일 때는 모드를 변경할 수 없습니다.');
        return;
    }
    setTimerType(type);
    // 모드 변경 시 타이머 초기화
    resetTimers();
  };

  const resetTimers = () => {
    setIsActive(false);
    setStopwatchTime(0);
    setPomodoroTimeLeft(FOCUS_DURATION);
    setPomodoroMode('focus');
    setPomodoroCycle(0);
  }

  // --- 스톱워치 기능 ---
  const handleStopwatchStop = () => {
    if (stopwatchTime < 60) { // 1분 미만은 기록하지 않음
      Alert.alert('알림', '최소 1분 이상 측정해야 기록이 저장됩니다.');
      resetTimers();
      return;
    }
    saveStudySession(stopwatchTime);
    setIsActive(false);
    Alert.alert('기록 완료', `${formatTime(stopwatchTime)}의 학습 시간이 저장되었습니다.`);
    resetTimers();
  };


  // --- 뽀모도로 기능 ---
  const handlePomodoroEnd = () => {
    Vibration.vibrate([500, 500, 500]);
    setIsActive(false);
    let nextMode: PomodoroMode;
    let nextTime: number;

    if (pomodoroMode === 'focus') {
      const newCycle = pomodoroCycle + 1;
      saveStudySession(FOCUS_DURATION); // 집중 시간 기록
      setPomodoroCycle(newCycle);

      if (newCycle % POMODOROS_UNTIL_LONG_BREAK === 0) {
        nextMode = 'longBreak';
        nextTime = LONG_BREAK_DURATION;
        Alert.alert('세션 완료!', '4 뽀모도로를 완료했습니다! 긴 휴식을 시작하세요.');
      } else {
        nextMode = 'shortBreak';
        nextTime = SHORT_BREAK_DURATION;
        Alert.alert('집중 완료!', '수고하셨습니다. 짧은 휴식 시간입니다.');
      }
    } else { // 휴식 시간이 끝났을 때
      nextMode = 'focus';
      nextTime = FOCUS_DURATION;
      Alert.alert('휴식 끝!', '다시 집중할 시간입니다.');
    }
    setPomodoroMode(nextMode);
    setPomodoroTimeLeft(nextTime);
  };


  // --- Firebase 데이터 저장 ---
  const saveStudySession = async (durationInSeconds: number) => {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      Alert.alert('오류', '로그인 정보가 없습니다.');
      return;
    }
    try {
      await firestore().collection('study_sessions').add({
        userId: currentUser.uid,
        durationInSeconds: durationInSeconds,
        completedAt: firestore.FieldValue.serverTimestamp(),
        timerType: timerType, // 어떤 타이머로 기록했는지 저장
      });
      console.log('학습 기록 저장 성공!');
    } catch (error) {
      console.error('학습 기록 저장 실패:', error);
      Alert.alert('오류', '기록 저장에 실패했습니다.');
    }
  };

  // --- UI 렌더링 ---
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = (num: number) => num.toString().padStart(2, '0');
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
  };

  // 원형 프로그레스 바 계산
  const getPomodoroProgressProps = () => {
    const radius = 120;
    const strokeWidth = 15;
    const circumference = 2 * Math.PI * radius;
    let totalTime;
    switch(pomodoroMode) {
      case 'focus': totalTime = FOCUS_DURATION; break;
      case 'shortBreak': totalTime = SHORT_BREAK_DURATION; break;
      case 'longBreak': totalTime = LONG_BREAK_DURATION; break;
    }
    const strokeDashoffset = circumference - (pomodoroTimeLeft / totalTime) * circumference;
    const color = pomodoroMode === 'focus' ? '#FF8F00' : '#4CAF50';
    return { radius, strokeWidth, circumference, strokeDashoffset, color };
  };

  const pomodoroProgress = getPomodoroProgressProps();

  return (
    <ScrollView style={styles.container}>
      {/* 타이머 타입 선택기 */}
      <View style={styles.typeSelector}>
        <TouchableOpacity
          style={[styles.typeButton, timerType === 'stopwatch' && styles.activeType]}
          onPress={() => changeTimerType('stopwatch')}>
          <Text style={[styles.typeText, timerType === 'stopwatch' && styles.activeText]}>스톱워치</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeButton, timerType === 'pomodoro' && styles.activeType]}
          onPress={() => changeTimerType('pomodoro')}>
          <Text style={[styles.typeText, timerType === 'pomodoro' && styles.activeText]}>뽀모도로</Text>
        </TouchableOpacity>
      </View>

      {/* 타이머 디스플레이 */}
      <View style={styles.timerDisplay}>
        {timerType === 'stopwatch' ? (
          <Text style={[styles.timerText, { fontSize: 72 }]}>{formatTime(stopwatchTime)}</Text>
        ) : (
          <View style={styles.pomodoroContainer}>
            <Svg width={pomodoroProgress.radius * 2} height={pomodoroProgress.radius * 2} style={styles.svg}>
              <Circle cx={pomodoroProgress.radius} cy={pomodoroProgress.radius} r={pomodoroProgress.radius - pomodoroProgress.strokeWidth / 2} stroke="#eee" strokeWidth={pomodoroProgress.strokeWidth} />
              <Circle
                cx={pomodoroProgress.radius}
                cy={pomodoroProgress.radius}
                r={pomodoroProgress.radius - pomodoroProgress.strokeWidth / 2}
                stroke={pomodoroProgress.color}
                strokeWidth={pomodoroProgress.strokeWidth}
                strokeDasharray={pomodoroProgress.circumference}
                strokeDashoffset={pomodoroProgress.strokeDashoffset}
                strokeLinecap="round"
              />
            </Svg>
            <Text style={styles.timerText}>{formatTime(pomodoroTimeLeft)}</Text>
            <Text style={styles.pomodoroModeText}>
              {pomodoroMode === 'focus' ? `집중 (${pomodoroCycle + 1}번째)` : pomodoroMode === 'shortBreak' ? '짧은 휴식' : '긴 휴식'}
            </Text>
          </View>
        )}
      </View>

      {/* 컨트롤 버튼 */}
      <View style={styles.controls}>
        {!isActive && (stopwatchTime > 0 || pomodoroTimeLeft < FOCUS_DURATION) && (
            <TouchableOpacity style={styles.button} onPress={resetTimers}>
                <Text style={styles.buttonText}>리셋</Text>
            </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.button, styles.mainButton]}
          onPress={() => setIsActive(!isActive)}>
          <Text style={[styles.buttonText, styles.mainButtonText]}>
            {isActive ? '일시정지' : '시작'}
          </Text>
        </TouchableOpacity>

        {isActive && timerType === 'stopwatch' && (
            <TouchableOpacity style={styles.button} onPress={handleStopwatchStop}>
                <Text style={styles.buttonText}>정지 및 저장</Text>
            </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};


const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#fff',
    },
    typeSelector: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginVertical: 20,
      backgroundColor: '#f0f0f0',
      borderRadius: 10,
      marginHorizontal: 20,
    },
    typeButton: {
      flex: 1,
      padding: 15,
      alignItems: 'center',
      borderRadius: 10,
    },
    activeType: {
      backgroundColor: '#FF8F00',
    },
    typeText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#888',
    },
    activeText: {
      color: '#fff',
    },
    timerDisplay: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 350,
    },
    timerText: {
      fontSize: 60,
      fontWeight: 'bold',
      color: '#333',
    },
    pomodoroContainer: {
        justifyContent: 'center',
        alignItems: 'center'
    },
    pomodoroModeText: {
        position: 'absolute',
        bottom: 50,
        fontSize: 20,
        fontWeight: '600',
        color: '#555'
    },
    svg: {
      transform: [{ rotate: '-90deg' }],
      position: 'absolute'
    },
    controls: {
      flexDirection: 'row',
      justifyContent: 'space-evenly',
      alignItems: 'center',
      width: '100%',
      paddingBottom: 40,
    },
    button: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: '#f0f0f0',
      justifyContent: 'center',
      alignItems: 'center',
    },
    mainButton: {
      backgroundColor: '#FF8F00',
    },
    buttonText: {
      fontSize: 18,
      color: '#333',
      fontWeight: '600'
    },
    mainButtonText: {
      color: '#fff',
      fontSize: 22,
      fontWeight: 'bold',
    },
  });

export default StudyTimer;