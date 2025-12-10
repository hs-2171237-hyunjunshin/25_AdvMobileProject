import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  Alert,
  ScrollView,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Svg, { Circle } from 'react-native-svg';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import BackgroundTimer from 'react-native-background-timer';

// --- 타입 정의 ---
type TimerType = 'stopwatch' | 'pomodoro';
type PomodoroMode = 'focus' | 'shortBreak' | 'longBreak';
interface PomodoroSettings {
  focus: number;
  shortBreak: number;
  longBreak: number;
}

const POMODOROS_UNTIL_LONG_BREAK = 4;

const StudyTimer: React.FC = () => {
  // --- 상태 관리 ---
  const [timerType, setTimerType] = useState<TimerType>('stopwatch');
  const [isActive, setIsActive] = useState(false);
  let intervalId: number | null = null;

  // 모달 상태
  const [subjectModalVisible, setSubjectModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);

  // 과목 상태
  const [subjects, setSubjects] = useState<string[]>([]);
  const [currentSubject, setCurrentSubject] = useState<string>('');
  const [newSubject, setNewSubject] = useState('');

  // 뽀모도로 상태
  const [pomodoroMode, setPomodoroMode] = useState<PomodoroMode>('focus');
  const [pomodoroTimeLeft, setPomodoroTimeLeft] = useState(25 * 60);
  const [pomodoroCycle, setPomodoroCycle] = useState(0);

  // 사용자 설정 상태
  const [settings, setSettings] = useState<PomodoroSettings>({ focus: 25, shortBreak: 5, longBreak: 15 });
  const [tempSettings, setTempSettings] = useState<PomodoroSettings>({ focus: 25, shortBreak: 5, longBreak: 15 });

  // 스톱워치 상태
  const [stopwatchTime, setStopwatchTime] = useState(0);

  // --- 데이터 로딩 ---
    useEffect(() => {
      const currentUser = auth().currentUser;
      if (currentUser) {
        const userDocRef = firestore().collection('users').doc(currentUser.uid);

        const subscriber = userDocRef.onSnapshot(
          doc => {
            if (doc && doc.exists) {
              const data = doc.data();
              if (!data) return;

              const userSubjects = data.subjects || ['기본'];
              setSubjects(userSubjects);
              if (!currentSubject || !userSubjects.includes(currentSubject)) {
                setCurrentSubject(userSubjects[0] || '');
              }

              const userSettings = data.pomodoroSettings || { focus: 25, shortBreak: 5, longBreak: 15 };
              setSettings(userSettings);
              setTempSettings(userSettings);

              if (!isActive && timerType === 'pomodoro') {
                setPomodoroTimeLeft(userSettings.focus * 60);
              }
            } else {
              //사용자는 있지만 users 문서가 없는 경우, 문서를 생성해준다.
              console.log('[StudyTimer] 신규 사용자를 위한 문서를 생성합니다.');
              const defaultSubjects = ['기본'];
              const defaultSettings = { focus: 25, shortBreak: 5, longBreak: 15 };
              userDocRef.set({
                subjects: defaultSubjects,
                pomodoroSettings: defaultSettings
              }).then(() => {
                 // 문서 생성 후 상태 설정
                 setSubjects(defaultSubjects);
                 setCurrentSubject(defaultSubjects[0]);
                 setSettings(defaultSettings);
                 setTempSettings(defaultSettings);
              }).catch(error => {
                  console.error('[StudyTimer] 신규 사용자 문서 생성 실패:', error);
              });
            }
          },
          error => {
            console.error('[StudyTimer] onSnapshot 리스너 오류:', error);
            Alert.alert('데이터 로딩 오류', '사용자 정보를 불러오는 데 실패했습니다.');
          }
        );

        return () => subscriber();
      }
    }, []); // 의존성 배열을 비워서 최초 1회만 실행되도록 함

  // --- 타이머 로직 (Core) ---
  useEffect(() => {


    if (isActive) {
      intervalId = BackgroundTimer.setInterval(() => {
        if (timerType === 'stopwatch') {
          setStopwatchTime(prev => prev + 1);
        } else {
          setPomodoroTimeLeft(prev => {
            if (prev > 1) return prev - 1;
            handlePomodoroEnd();
            return 0;
          });
        }
      }, 1000);
    } else if (intervalId) {
      BackgroundTimer.clearInterval(intervalId);
    }
    return () => { if (intervalId) BackgroundTimer.clearInterval(intervalId); };
  }, [isActive, timerType, settings]); // settings 추가

  // --- 기능 함수들 ---
  const changeTimerType = (type: TimerType) => {

    if (type === timerType) return;
    if (isActive) {
      Alert.alert('알림', '타이머가 실행 중일 때는 모드를 변경할 수 없습니다.');
      return;
    }
    const hasProgress = stopwatchTime > 0 || pomodoroTimeLeft < settings.focus * 60;
    if (hasProgress) {
          Alert.alert(
            "모드 변경",
            "진행 중인 시간이 있습니다. 시간을 저장하고 모드를 변경하시겠습니까?",
            [
              {
                text: "취소",
                style: "cancel"
              },
              {
                text: "저장 후 변경",
                onPress: () => {
                  // 현재 타입에 따라 저장 로직 호출
                  if (timerType === 'stopwatch') {
                    handleStopwatchStop(); // 스톱워치 저장 및 초기화
                  } else {
                    const elapsedTime = settings.focus * 60 - pomodoroTimeLeft;
                    if (elapsedTime >= 60) {
                      saveStudySession(elapsedTime);
                      Alert.alert('기록 완료', `${formatTime(elapsedTime)}의 학습 시간이 저장되었습니다.`);
                    }
                    resetTimers(); // 뽀모도로 초기화
                  }
                  // 새로운 타이머 타입으로 변경
                  setTimerType(type);
                }
              },
              {
                text: "저장 안함",
                onPress: () => {
                  // 그냥 초기화하고 타입만 변경
                  resetTimers();
                  setTimerType(type);
                },
                style: "destructive" // '삭제'와 비슷한 느낌을 줌
              }
            ]
          );
        } else {
          // 진행된 시간이 없으면 그냥 타입 변경
          setTimerType(type);
          resetTimers(); // 모드에 맞춰 타이머 기본값 리셋
        }
  };

  const resetTimers = () => {
    setIsActive(false);
    setStopwatchTime(0);
    setPomodoroTimeLeft(settings.focus * 60);
    setPomodoroMode('focus');
    setPomodoroCycle(0);
  };

  const handlePomodoroEnd = () => {
    Vibration.vibrate([500, 500, 500]);
    setIsActive(false);
    let nextMode: PomodoroMode;
    let nextTime: number;

    if (pomodoroMode === 'focus') {
      const newCycle = pomodoroCycle + 1;
      saveStudySession(settings.focus * 60);
      setPomodoroCycle(newCycle);

      if (newCycle % POMODOROS_UNTIL_LONG_BREAK === 0) {
        nextMode = 'longBreak';
        nextTime = settings.longBreak * 60;
        Alert.alert('세션 완료!', `4 뽀모도로를 완료했습니다! ${settings.longBreak}분간 긴 휴식을 시작하세요.`);
      } else {
        nextMode = 'shortBreak';
        nextTime = settings.shortBreak * 60;
        Alert.alert('집중 완료!', `수고하셨습니다. ${settings.shortBreak}분간 짧은 휴식을 취하세요.`);
      }
    } else {
      nextMode = 'focus';
      nextTime = settings.focus * 60;
      Alert.alert('휴식 끝!', '다시 집중할 시간입니다.');
    }
    setPomodoroMode(nextMode);
    setPomodoroTimeLeft(nextTime);
  };

  const handleStopwatchStop = () => {
    if (stopwatchTime < 60) {
      Alert.alert('알림', '최소 1분 이상 측정해야 기록이 저장됩니다.');
      resetTimers();
      return;
    }
    saveStudySession(stopwatchTime);
    setIsActive(false);
    Alert.alert('기록 완료', `${formatTime(stopwatchTime)}의 학습 시간이 저장되었습니다.`);
    resetTimers();
  };

  const saveStudySession = async (durationInSeconds: number) => {
    if (!currentSubject) {
      Alert.alert('오류', '측정을 시작하기 전에 과목을 선택해주세요.');
      setIsActive(false);
      return;
    }
    const currentUser = auth().currentUser;
    if (!currentUser) return;
    try {
      await firestore().collection('study_sessions').add({
        userId: currentUser.uid,
        durationInSeconds,
        completedAt: firestore.FieldValue.serverTimestamp(),
        timerType: timerType,
        subject: currentSubject,
      });
      console.log('학습 기록 저장 성공!');
    } catch (error) {
      console.error('학습 기록 저장 실패:', error);
    }
  };

  // 과목 관리
  const handleAddSubject = async () => {
    if (newSubject.trim() === '') return;
    const currentUser = auth().currentUser;
    if (currentUser) {
      const updatedSubjects = [...subjects, newSubject.trim()];
      await firestore().collection('users').doc(currentUser.uid).set({ subjects: updatedSubjects }, { merge: true });
      setNewSubject('');
    }
  };
  const handleDeleteSubject = async (subjectToDelete: string) => {
    const currentUser = auth().currentUser;
    if (currentUser) {
      const updatedSubjects = subjects.filter(s => s !== subjectToDelete);
      await firestore().collection('users').doc(currentUser.uid).set({ subjects: updatedSubjects }, { merge: true });
      if (currentSubject === subjectToDelete) {
        setCurrentSubject(updatedSubjects[0] || '');
      }
    }
  };

  // 설정 저장
  const handleSaveSettings = async () => {
    const currentUser = auth().currentUser;
    if (currentUser) {
      await firestore().collection('users').doc(currentUser.uid)
        .set({ pomodoroSettings: tempSettings }, { merge: true });
      Alert.alert('성공', '설정이 저장되었습니다.');
      setSettingsModalVisible(false);
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

  const getPomodoroProgressProps = () => {
    const radius = 120;
    const strokeWidth = 15;
    const circumference = 2 * Math.PI * radius;
    let totalTime;
    switch (pomodoroMode) {
      case 'focus': totalTime = settings.focus * 60; break;
      case 'shortBreak': totalTime = settings.shortBreak * 60; break;
      case 'longBreak': totalTime = settings.longBreak * 60; break;
      default: totalTime = settings.focus * 60;
    }
    const strokeDashoffset = totalTime > 0 ? circumference - (pomodoroTimeLeft / totalTime) * circumference : circumference;
    const color = pomodoroMode === 'focus' ? '#FF8F00' : '#4CAF50';
    return { radius, strokeWidth, circumference, strokeDashoffset, color };
  };

  const pomodoroProgress = getPomodoroProgressProps();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.typeSelector}>
        <TouchableOpacity style={[styles.typeButton, timerType === 'stopwatch' && styles.activeType]} onPress={() => changeTimerType('stopwatch')}>
          <Text style={[styles.typeText, timerType === 'stopwatch' && styles.activeText]}>스톱워치</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.typeButton, timerType === 'pomodoro' && styles.activeType]} onPress={() => changeTimerType('pomodoro')}>
          <Text style={[styles.typeText, timerType === 'pomodoro' && styles.activeText]}>뽀모도로</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.subjectSelector}>
        <Text style={styles.subjectLabel}>과목:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subjectScrollView}>
          {subjects.map((subject) => (
            <TouchableOpacity key={subject} style={[styles.subjectButton, currentSubject === subject && styles.activeSubjectButton]} onPress={() => setCurrentSubject(subject)}>
              <Text style={[styles.subjectButtonText, currentSubject === subject && styles.activeSubjectText]}>{subject}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.iconButton} onPress={() => setSubjectModalVisible(true)}>
          <MaterialIcons name="edit" size={24} color="#555" />
        </TouchableOpacity>
        {timerType === 'pomodoro' && (
          <TouchableOpacity style={styles.iconButton} onPress={() => setSettingsModalVisible(true)}>
            <MaterialIcons name="settings" size={24} color="#555" />
          </TouchableOpacity>
        )}
      </View>

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

      <View style={styles.controls}>
        {!isActive && (stopwatchTime > 0 || pomodoroTimeLeft < settings.focus * 60) && (
            <TouchableOpacity style={styles.button} onPress={resetTimers}>
                <Text style={styles.buttonText}>리셋</Text>
            </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.button, styles.mainButton]} onPress={() => setIsActive(!isActive)}>
          <Text style={[styles.buttonText, styles.mainButtonText]}>{isActive ? '일시정지' : '시작'}</Text>
        </TouchableOpacity>
        {isActive && timerType === 'stopwatch' && (
            <TouchableOpacity style={styles.button} onPress={handleStopwatchStop}>
                <Text style={styles.buttonText}>정지 및 저장</Text>
            </TouchableOpacity>
        )}
      </View>

      <Modal visible={subjectModalVisible} animationType="slide" transparent={true} onRequestClose={() => setSubjectModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>과목 편집</Text>
            <FlatList
              data={subjects}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <View style={styles.subjectItem}>
                  <Text style={styles.subjectItemText}>{item}</Text>
                  <TouchableOpacity onPress={() => handleDeleteSubject(item)}><MaterialIcons name="delete-outline" size={24} color="#E53935" /></TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>과목 리스트가 비었습니다.</Text>}
            />
            <View style={styles.addSubjectContainer}>
              <TextInput style={styles.modalInput} placeholder="새 과목 이름" value={newSubject} onChangeText={setNewSubject} />
              <TouchableOpacity style={styles.addButton} onPress={handleAddSubject}><MaterialIcons name="add" size={24} color="#fff" /></TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={() => setSubjectModalVisible(false)}><Text style={styles.closeButtonText}>닫기</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={settingsModalVisible} animationType="slide" transparent={true} onRequestClose={() => setSettingsModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>뽀모도로 설정</Text>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>집중 시간 (분)</Text>
              <TextInput style={styles.settingInput} keyboardType="number-pad" value={String(tempSettings.focus)} onChangeText={text => setTempSettings(s => ({ ...s, focus: Number(text) || 0 }))}/>
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>짧은 휴식 (분)</Text>
              <TextInput style={styles.settingInput} keyboardType="number-pad" value={String(tempSettings.shortBreak)} onChangeText={text => setTempSettings(s => ({ ...s, shortBreak: Number(text) || 0 }))}/>
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>긴 휴식 (분)</Text>
              <TextInput style={styles.settingInput} keyboardType="number-pad" value={String(tempSettings.longBreak)} onChangeText={text => setTempSettings(s => ({ ...s, longBreak: Number(text) || 0 }))}/>
            </View>
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity style={[styles.modalButton, {backgroundColor: '#aaa'}]} onPress={() => setSettingsModalVisible(false)}><Text style={styles.modalButtonText}>취소</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, {backgroundColor: '#FF8F00'}]} onPress={handleSaveSettings}><Text style={styles.modalButtonText}>저장</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    typeSelector: { flexDirection: 'row', justifyContent: 'center', marginVertical: 20, backgroundColor: '#f0f0f0', borderRadius: 10, marginHorizontal: 20 },
    typeButton: { flex: 1, padding: 15, alignItems: 'center', borderRadius: 10 },
    activeType: { backgroundColor: '#FF8F00' },
    typeText: { fontSize: 16, fontWeight: 'bold', color: '#888' },
    activeText: { color: '#fff' },
    subjectSelector: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
    subjectLabel: { fontSize: 16, fontWeight: 'bold', marginRight: 10 },
    subjectScrollView: { flex: 1 },
    subjectButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#eee', marginRight: 10 },
    activeSubjectButton: { backgroundColor: '#FF8F00' },
    subjectButtonText: { fontSize: 14, color: '#333' },
    activeSubjectText: { color: '#fff', fontWeight: 'bold' },
    iconButton: { padding: 5, marginLeft: 10 },
    timerDisplay: { alignItems: 'center', justifyContent: 'center', height: 350 },
    timerText: { fontSize: 60, fontWeight: 'bold', color: '#333' },
    pomodoroContainer: { justifyContent: 'center', alignItems: 'center' },
    pomodoroModeText: { position: 'absolute', bottom: 50, fontSize: 20, fontWeight: '600', color: '#555' },
    svg: { transform: [{ rotate: '-90deg' }], position: 'absolute' },
    controls: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', width: '100%', paddingBottom: 40 },
    button: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
    mainButton: { backgroundColor: '#FF8F00' },
    buttonText: { fontSize: 18, color: '#333', fontWeight: '600' },
    mainButtonText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
    modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalContent: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    subjectItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
    subjectItemText: { fontSize: 16 },
    emptyText: { textAlign: 'center', color: '#888', marginVertical: 20 },
    addSubjectContainer: { flexDirection: 'row', marginTop: 20, },
    modalInput: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 15, marginRight: 10, height: 44 },
    addButton: { backgroundColor: '#FF8F00', borderRadius: 8, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 15, height: 44 },
    closeButton: { marginTop: 20, backgroundColor: '#f0f0f0', borderRadius: 8, padding: 15, alignItems: 'center' },
    closeButtonText: { fontSize: 16, fontWeight: 'bold' },
    settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 15, paddingHorizontal: 10 },
    settingLabel: { fontSize: 18 },
    settingInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, width: 80, textAlign: 'center', fontSize: 16 },
    modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 30 },
    modalButton: { paddingVertical: 12, paddingHorizontal: 40, borderRadius: 8 },
    modalButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});

export default StudyTimer;