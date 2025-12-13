import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, Modal, TextInput, Button, TouchableOpacity } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import type { DateData } from 'react-native-calendars/src/types';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { useFocusEffect } from '@react-navigation/native';
import TaskStatsPie from './notification/TaskStatsPie';
import notifee, { TriggerType, AndroidImportance } from '@notifee/react-native';


// 한글 설정
LocaleConfig.locales['ko'] = {
  monthNames: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  monthNamesShort: ['1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.', '10.', '11.', '12.'],
  dayNames: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
  dayNamesShort: ['일', '월', '화', '수', '목', '금', '토'],
  today: '오늘'
};
LocaleConfig.defaultLocale = 'ko';

// 학습 세션 데이터 타입 정의
interface SessionsByDate {
  [date: string]: {
    totalSeconds: number;
    subjects: { [subject: string]: number };
  };
}
  export async function addDeadline(dateString: string, title: string, time: string) {
  try {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      Alert.alert("오류", "로그인이 필요합니다.");
      return;
    }

    if (!title.trim()) {
      Alert.alert("알림", "내용을 입력해주세요.");
      return;
    }

    //권한 및 채널 설정
    await notifee.requestPermission();
    const channelId = await notifee.createChannel({
      id: 'deadline-alert',
      name: '마감일 알림',
      importance: AndroidImportance.HIGH,
    });

    // 날짜 계산
    const deadlineDate = new Date(`${dateString}T${time}:00`);
    const deadlineTime = deadlineDate.getTime();
    
    //예약 함수 정의
    const scheduleAlert = async (triggerTime: number, bodyText: string) => {
      const now = Date.now();
      if (triggerTime > now) {
        await notifee.createTriggerNotification(
          {
            title: ` 마감 임박: ${title}`,
            body: bodyText,
            android: { channelId, pressAction: { id: 'default' }, smallIcon: 'ic_launcher' },
          },
          { type: TriggerType.TIMESTAMP, timestamp: triggerTime }
        );
      }
    };

    // 24시간 전, 1시간 전 예약 실행
    await scheduleAlert(deadlineTime - (24 * 60 * 60 * 1000), "마감 하루 전입니다! 준비하세요 🔥");
    await scheduleAlert(deadlineTime - (1 * 60 * 60 * 1000), "마감 1시간 전입니다! ⏳");

    // deadlines 컬렉션에 저장 (캘린더 표시용)
    await firestore().collection("deadlines").add({
      userId: currentUser.uid,
      date: dateString,
      title: title,
      time: time,
      isCompleted: false,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });

    // 마감일이 생성기록
    await firestore().collection("notifications").add({
      userId: currentUser.uid,
      type: "deadline_created",
      title: "새로운 마감일 설정됨",
      message: `'${title}' 마감일(${dateString} ${time})이 등록되었습니다.`,
      isRead: false,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });

    Alert.alert("성공", "마감일과 알림이 설정되었습니다!");

  } catch (error) {
    console.error("저장 실패:", error);
    Alert.alert("오류", "문제가 발생했습니다.");
  }
}
interface ScheduleItem {
  id: string;
  title: string;
  dueDate: string;
  description: string;
  isGroupSchedule?: boolean; // 그룹 일정 여부
  groupName?: string; // 그룹 이름
}

interface SchedulesByDate {
  [date: string]: ScheduleItem[];
}


const StudyCalendar: React.FC = () => {
  const [sessionsByDate, setSessionsByDate] = useState<SessionsByDate>({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  //개인 일정 및 과제 
  const [assignmentsByDate, setAssignmentsByDate] = useState<AssignmentsByDate>({});
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newAssignment, setNewAssignment] = useState({ title: '', description: '' });

  //마감일 설정 관련
  const [deadlineModalVisible, setDeadlineModalVisible] = useState(false);
  const [deadlineTitle, setDeadlineTitle] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("18:00");

  //마감일 불러오기
  const [deadlineList, setDeadlineList] = useState<any[]>([]);
  useEffect(() => {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    // 'deadlines' 컬렉션에서 내 데이터만 실시간으로 가져옴
    const unsubscribe = firestore()
      .collection('deadlines')
      .where('userId', '==', currentUser.uid)
      //.orderBy('createdAt', 'desc') // 최신순 정렬
      .onSnapshot(snapshot => {
        if (!snapshot) return; 
        const list = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setDeadlineList(list);
      }, error => {
        console.log("데이터 불러오기 에러:", error);
      });

    return () => unsubscribe();
  }, []);
  const monthRef = useRef(currentMonthDate);
  useEffect(() => {
    monthRef.current = currentMonthDate;
  }, [currentMonthDate]);


  const [groupSchedules, setGroupSchedules] = useState<SchedulesByDate>({});

  const fetchStudySessions = useCallback(async (dateToFetch: Date) => {
    console.log(`[Calendar] 데이터 요청: ${dateToFetch.getFullYear()}년 ${dateToFetch.getMonth() + 1}월`);
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    const startOfMonth = new Date(dateToFetch.getFullYear(), dateToFetch.getMonth(), 1);
    const endOfMonth = new Date(dateToFetch.getFullYear(), dateToFetch.getMonth() + 1, 0, 23, 59, 59);

    try {
      const querySnapshot = await firestore()
        .collection('study_sessions')
        .where('userId', '==', currentUser.uid)
        .where('completedAt', '>=', startOfMonth)
        .where('completedAt', '<=', endOfMonth)
        .get();

      if (querySnapshot.empty) {
        console.log('[Calendar] 해당 월에 데이터 없음.');
        setSessionsByDate(prev => {
          const nextState = { ...prev };
          Object.keys(nextState).forEach(date => {
            const d = new Date(date);
            if (d.getFullYear() === dateToFetch.getFullYear() && d.getMonth() === dateToFetch.getMonth()) {
              delete nextState[date];
            }
          });
          return nextState;
        });
        return;
      }

      const newSessions: SessionsByDate = {};
      querySnapshot.forEach(doc => {
        const data = doc.data();
        if (data.completedAt) {
          const dateString = data.completedAt.toDate().toISOString().split('T')[0];
          const subject = data.subject || '기타';
          if (!newSessions[dateString]) {
            newSessions[dateString] = { totalSeconds: 0, subjects: {} };
          }
          newSessions[dateString].totalSeconds += data.durationInSeconds;
          if (!newSessions[dateString].subjects[subject]) {
            newSessions[dateString].subjects[subject] = 0;
          }
          newSessions[dateString].subjects[subject] += data.durationInSeconds;
        }
      });
      setSessionsByDate(prev => ({ ...prev, ...newSessions }));
    } catch (error) {
      console.error("[Calendar] 공부 기록 로딩 실패:", error);
      Alert.alert('오류', '공부 기록을 불러오는 데 실패했습니다.');
    }
  }, []);

    const fetchGroupSchedules = useCallback(async (dateToFetch: Date) => {
        const currentUser = auth().currentUser;
        if (!currentUser) return;

        try {
          const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
          const joinedGroups = userDoc.data()?.joinedGroups || [];

          if (joinedGroups.length === 0) {
            setGroupSchedules({}); // 가입한 그룹이 없으면 비움
            return;
          }

          const startOfMonth = new Date(dateToFetch.getFullYear(), dateToFetch.getMonth(), 1).toISOString().split('T')[0];
          const endOfMonth = new Date(dateToFetch.getFullYear(), dateToFetch.getMonth() + 1, 0).toISOString().split('T')[0];

          // 각 그룹의 정보를 미리 가져옴
          const groupPromises = joinedGroups.map((groupId: string) =>
            firestore().collection('studyGroups').doc(groupId).get()
          );
          const groupDocs = await Promise.all(groupPromises);
          const groupNameMap: { [id: string]: string } = {};
          groupDocs.forEach(doc => {
            if (doc.exists) {
              groupNameMap[doc.id] = doc.data()?.name || '알 수 없는 그룹';
            }
          });

          // 각 그룹의 일정을 가져옴
          const schedulePromises = joinedGroups.map((groupId: string) =>
            firestore()
              .collection('studyGroups').doc(groupId)
              .collection('schedules')
              .where('date', '>=', startOfMonth)
              .where('date', '<=', endOfMonth)
              .get()
          );
          const scheduleSnapshots = await Promise.all(schedulePromises);

          const newSchedulesByDate: SchedulesByDate = {};

          scheduleSnapshots.forEach((snapshot, index) => {
            const groupId = joinedGroups[index];
            snapshot.forEach(doc => {
              const data = doc.data();

              //그룹 일정 객체를 생성할 때, isGroupSchedule과 groupName을 추가합니다.
              const schedule: ScheduleItem = {
                id: `${groupId}_${doc.id}`, // ID가 겹치지 않도록 그룹ID와 문서ID를 조합
                title: data.title,
                dueDate: data.date, // 필드 이름을 개인 일정과 맞춤
                // 그룹 일정임을 명시
                isGroupSchedule: true,
                // 그룹 이름을 포함
                groupName: groupNameMap[groupId],
                description: data.description || `작성자: ${data.authorName}`,
              };

              if (!newSchedulesByDate[schedule.dueDate]) {
                newSchedulesByDate[schedule.dueDate] = [];
              }
              newSchedulesByDate[schedule.dueDate].push(schedule);
            });
          });

          setGroupSchedules(newSchedulesByDate);
        } catch (error) {
          console.error('[Calendar] 그룹 일정 로딩 실패:', error);
        }
      }, []);

  const fetchAssignments = useCallback(async (dateToFetch: Date) => {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      const startOfMonth = new Date(dateToFetch.getFullYear(), dateToFetch.getMonth(), 1);
      const endOfMonth = new Date(dateToFetch.getFullYear(), dateToFetch.getMonth() + 1, 0);

      try {
          const querySnapshot = await firestore()
              .collection('assignments')
              .where('userId', '==', currentUser.uid)
              .where('dueDate', '>=', startOfMonth.toISOString().split('T')[0])
              .where('dueDate', '<=', endOfMonth.toISOString().split('T')[0])
              .get();

          const newAssignments: SchedulesByDate = {};
          querySnapshot.forEach(doc => {
              const data = doc.data() as Omit<Assignment, 'id'>;
              const assignment: ScheduleItem = { ...data, id: doc.id };
              if (!newAssignments[assignment.dueDate]) {
                  newAssignments[assignment.dueDate] = [];
              }
              newAssignments[assignment.dueDate].push(assignment);
          });
          setAssignmentsByDate(prev => ({ ...prev, ...newAssignments }));
      } catch (error) {
          console.error("[Calendar] 과제/시험 일정 로딩 실패:", error);
          Alert.alert('오류', '일정을 불러오는 데 실패했습니다.');
      }
  }, []);

  useFocusEffect(useCallback(() => {
      fetchStudySessions(monthRef.current);
      fetchAssignments(monthRef.current);
      fetchGroupSchedules(monthRef.current);
  }, [fetchStudySessions, fetchAssignments, fetchGroupSchedules]));

  const onMonthChange = (date: DateData) => {
      const newMonthDate = new Date(date.timestamp);
      monthRef.current = newMonthDate;
      setCurrentMonthDate(newMonthDate);
      fetchStudySessions(newMonthDate);
      fetchAssignments(newMonthDate);
      fetchGroupSchedules(newMonthDate);
  };
  //마감일삭제
  const handleDeleteDeadline = (id: string, title: string) => {
    Alert.alert(
      "마감일 삭제",
      `'${title}' 항목을 삭제하시겠습니까?`,
      [
        { text: "취소", style: "cancel" },
        { 
          text: "삭제", 
          style: "destructive",
          onPress: async () => {
            try {
              await firestore().collection('deadlines').doc(id).delete();
              Alert.alert("삭제 완료", "마감일이 삭제되었습니다.");
            } catch (error) {
              console.error("삭제 실패:", error);
              Alert.alert("오류", "삭제 중 문제가 발생했습니다.");
            }
          }
        }
      ]
    );
  };

  const markedDates = useMemo(() => {
        const marked: { [key: string]: any } = {};

        // 1. 공부 기록에 대한 배경색 마킹
        for (const date in sessionsByDate) {
          const dailyTotal = sessionsByDate[date].totalSeconds;
          const hours = dailyTotal / 3600;
          let opacity = Math.min(1, Math.max(0.2, hours / 4));
          marked[date] = {
            customStyles: {
              container: { backgroundColor: `rgba(255, 143, 0, ${opacity})`, borderRadius: 8 },
              text: { color: opacity > 0.6 ? 'white' : 'black', fontWeight: 'bold' },
            },
          };
        }






        // 2. 과제/시험 일정에 대한 점 마킹
        const allSchedules: SchedulesByDate = { ...assignmentsByDate };
        Object.keys(groupSchedules).forEach(date => {
            if (allSchedules[date]) {
                // 해당 날짜에 이미 개인 일정이 있으면 그룹 일정을 뒤에 추가
                allSchedules[date] = [...allSchedules[date], ...groupSchedules[date]];
            } else {
                // 해당 날짜에 개인 일정이 없으면 그룹 일정으로 새로 할당
                allSchedules[date] = groupSchedules[date];
            }
        });
    
        for (const date in allSchedules) {
            if (!marked[date]) { marked[date] = {}; }
            if (!marked[date].customStyles) {
                marked[date].customStyles = {
                    container: {},
                    text: {},
                };
            }

            //이 날짜가 마킹 대상임을 알려줌
            marked[date].marked = true;

            // customStyles 안에 'dot' 스타일 추가
            marked[date].customStyles.dot = {
                backgroundColor: '#B71C1C',
                width: 8,
                height: 8,
                borderRadius: 4,
                marginTop: 1,
            };
        }

      const allSchedules: AssignmentsByDate = { ...assignmentsByDate };
      Object.keys(groupSchedules).forEach(date => {
          if (allSchedules[date]) {
              // 해당 날짜에 이미 개인 일정이 있으면 그룹 일정을 뒤에 추가
              allSchedules[date] = [...allSchedules[date], ...groupSchedules[date]];
          } else {
              // 해당 날짜에 개인 일정이 없으면 그룹 일정으로 새로 할당
              allSchedules[date] = groupSchedules[date];
          }
      });
    
      for (const item of deadlineList) {
          const date = item.date;
          if (!marked[date]) { marked[date] = {}; }
            if (!marked[date].customStyles) {
                marked[date].customStyles = {
                    container: {},
                    text: {},
                };
            }
            // 점(dot)을 표시하도록 설정
            marked[date].marked = true;
            marked[date].customStyles.dot = {
                backgroundColor: '#007BFF', // 마감일은 파란색 점으로 표시 (구분)
                width: 8,
                height: 8,
                borderRadius: 4,
                marginTop: 1,
            };
        }



        // 3. 선택된 날짜 스타일링 (안정성 강화)
        if (marked[selectedDate]) {
            if (!marked[selectedDate].customStyles) {
                marked[selectedDate].customStyles = {
                    container: { borderWidth: 2, borderRadius: 8 },
                    text: {},
                };
            }
            marked[selectedDate].customStyles.container.borderColor = '#AD5A00';
            if (!marked[selectedDate].customStyles.container.borderWidth) {
                 marked[selectedDate].customStyles.container.borderWidth = 2;
            }
        } else {
          marked[selectedDate] = {
            customStyles: {
              container: { borderColor: '#FF8F00', borderWidth: 2, borderRadius: 8 },
              text: { color: '#FF8F00' }
            }
          };
        }


        return marked;
      }, [sessionsByDate, assignmentsByDate,groupSchedules, deadlineList, selectedDate]);

  const selectedDateSchedules = useMemo(() => {
      const personal = assignmentsByDate[selectedDate] || [];
      const group = groupSchedules[selectedDate] || [];
      // 개인 일정을 앞에, 그룹 일정을 뒤에 배치하여 합침
      return [...personal, ...group];
    }, [selectedDate, assignmentsByDate, groupSchedules]);

  const weeklyData = useMemo(() => {
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    let totalSeconds = 0;
    const subjects: { [subject: string]: number } = {};
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(currentDate.getDate() + i);
      const dateString = currentDate.toISOString().split('T')[0];
      if (sessionsByDate[dateString]) {
        totalSeconds += sessionsByDate[dateString].totalSeconds;
        for (const subject in sessionsByDate[dateString].subjects) {
          if (!subjects[subject]) subjects[subject] = 0;
          subjects[subject] += sessionsByDate[dateString].subjects[subject];
        }
      }
    }
    return { totalSeconds, subjects };
  }, [selectedDate, sessionsByDate]);

  const chartData = useMemo(() => {
    const subjects = Object.entries(weeklyData.subjects).filter(([, value]) => value > 0);
    if (subjects.length === 0) return null;

    const series = subjects.map(([subject, seconds], index) => {
          const defaultColors = ['#FF8F00', '#FFC107', '#4CAF50', '#2196F3', '#9C27B0', '#795548'];
          return {
            value: seconds,
            color: defaultColors[index % defaultColors.length],
            legend: subject, // 범례(legend)에 사용할 이름 추가
          };
        });

        return { series };
      }, [weeklyData.subjects]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}시간 ${m}분`;
    return `${m}분`;
  };

  const handleSaveAssignment = async () => {
      const currentUser = auth().currentUser;
      if (!currentUser || !newAssignment.title) {
          Alert.alert('오류', '제목을 입력해주세요.');
          return;
      }

      try {
          await firestore().collection('assignments').add({
              userId: currentUser.uid,
              title: newAssignment.title,
              description: newAssignment.description,
              dueDate: selectedDate, // 현재 선택된 날짜가 마감일
          });
          Alert.alert('성공', '새로운 일정이 등록되었습니다.');
          setIsModalVisible(false);
          setNewAssignment({ title: '', description: '' });
          fetchAssignments(new Date(selectedDate)); // 목록 새로고침
      } catch (error) {
          console.error("일정 저장 실패:", error);
          Alert.alert('오류', '일정 등록에 실패했습니다.');
      }
  };
    // addDeadline 호출 후 마감일 목록 새로고침
  const handleSaveDeadline = async () => {
    await addDeadline(selectedDate, deadlineTitle, deadlineTime);
    setDeadlineModalVisible(false);
    setDeadlineTitle("");
    setDeadlineTime("18:00");
    // 마감일이 firestore에 추가되면 useEffect에 의해 deadlineList가 자동으로 업데이트됨.
    // 하지만, 안전을 위해 캘린더 마킹도 다시 계산되도록 상태 업데이트를 유도할 수 있음.
    // 여기서는 onSnapshot이 처리할 것이므로 별도 fetch는 생략합니다.
  };

  return (
    <>
    <ScrollView style={styles.container}>
      <Text style={styles.title}>스터디 캘린더</Text>
      <Calendar
        style={styles.calendar}
        current={currentMonthDate.toISOString().split('T')[0]}

        onDayPress={(day: DateData) => {
           setSelectedDate(day.dateString);
           setDeadlineModalVisible(true);  //마감일 추가
        }}

        onMonthChange={onMonthChange}
        markingType={'custom'}
        markedDates={markedDates}
        theme={{ calendarBackground: '#ffffff' }}
      />
        <View style={styles.assignmentsContainer}>
            <Text style={styles.assignmentsTitle}>{selectedDate} 일정</Text>
            {/* 개인 일정/그룹 일정/마감일을 포함하는 목록 */}
            {selectedDateSchedules.length > 0 || deadlineList.filter(item => item.date === selectedDate).length > 0 ? (
                <>
                {/* 마감일 목록 표시 (선택된 날짜에 해당하는 항목만) */}
                {deadlineList
                  .filter(item => item.date === selectedDate)
                  .map((item, index) => (
                    <TouchableOpacity
                      key={`deadline-${item.id || index}`}
                      onPress={() => handleDeleteDeadline(item.id, item.title)}
                      style={[styles.assignmentItem, { backgroundColor: '#fff3e0', borderWidth: 1, borderColor: '#ffb74d' }]} // 마감일 스타일 강조
                    >
                      <Text style={[styles.assignmentTitle, { color: '#AD5A00' }]}>🚨 마감일: {item.title}</Text>
                      <Text style={styles.assignmentDesc}>시간: {item.time}</Text>
                    </TouchableOpacity>
                  ))}
                
                {/* 일반 개인/그룹 일정 목록 표시 */}
                {selectedDateSchedules.map(item => (
                    <View key={item.id} style={styles.assignmentItem}>
                        <Text style={styles.assignmentTitle}>{item.title}</Text>
                        {/* 그룹 일정인 경우 출처 표시 */}
                        {item.isGroupSchedule && (
                            <Text style={styles.groupScheduleLabel}> (그룹: {item.groupName})</Text>
                        )}
                        <Text style={styles.assignmentDesc}>{item.description}</Text>
                    </View>
                ))}
                </>
            ) : (
                <Text style={styles.noAssignmentText}>등록된 일정이 없습니다.</Text>
            )}
            <TouchableOpacity style={styles.addButton} onPress={() => setIsModalVisible(true)}>
                <Text style={styles.addButtonText}>+ 새 일정 등록</Text>
            </TouchableOpacity>
        </View>

      <View style={styles.infoContainer}>
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>주간 총 공부 시간</Text>
          <Text style={styles.infoContent}>{formatTime(weeklyData.totalSeconds)}</Text>
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>과목별 공부 비중 (주간)</Text>
          {chartData ? (
            <View style={styles.chartContainer}>
              <TaskStatsPie chartData={chartData.series} />
              <View style={styles.legendContainer}>
                {chartData.series.map(item => (
                  <View key={item.legend} style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: item.color }]} />
                    <Text style={styles.legendText}>{item.legend} ({formatTime(item.value)})</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <Text style={styles.noDataText}>이번 주 공부 기록이 없습니다.</Text>
          )}
        </View>
        {/* 마감일 보기 */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}> 나의 마감일 목록</Text>
          {/*  삭제 기능 안내 문구 추가 */}
          <Text style={{ fontSize: 12, color: '#999', marginBottom: 10 }}>
            (항목을 누르면 삭제할 수 있습니다)
          </Text>

          {deadlineList.length > 0 ? (
            deadlineList.map((item, index) => (
              <TouchableOpacity
                key={item.id || index}
                onPress={() => handleDeleteDeadline(item.id, item.title)}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: '#eee'
                }}
              >
                <View>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>
                    {item.title}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                    {item.date} 마감
                  </Text>
                </View>
                <Text style={{ fontSize: 16, color: '#FF8F00', fontWeight: 'bold' }}>
                  {item.time}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={{ textAlign: 'center', color: '#aaa', paddingVertical: 20 }}>
              등록된 마감일이 없습니다.
            </Text>
          )}
        </View>
      </View>
      <Modal
            animationType="slide"
            transparent={true}
            visible={isModalVisible}
            onRequestClose={() => setIsModalVisible(false)}
      >
                  <View style={styles.modalContainer}>
                      <View style={styles.modalContent}>
                          <Text style={styles.modalTitle}>{selectedDate} 새 일정 등록</Text>
                          <TextInput
                              style={styles.input}
                              placeholder="제목"
                              value={newAssignment.title}
                              onChangeText={text => setNewAssignment(prev => ({ ...prev, title: text }))}
                          />
                          <TextInput
                              style={[styles.input, styles.multilineInput]}
                              placeholder="설명 (선택 사항)"
                              multiline
                              value={newAssignment.description}
                              onChangeText={text => setNewAssignment(prev => ({ ...prev, description: text }))}
                          />
                          <View style={styles.modalButtons}>
                              <Button title="취소" onPress={() => setIsModalVisible(false)} color="#888" />
                              <Button title="저장" onPress={handleSaveAssignment} />
                          </View>
                      </View>
                  </View>
      </Modal>

    </ScrollView>
    {deadlineModalVisible && (
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          
          <Text style={styles.modalTitle}>마감일 추가</Text>
          <Text style={{textAlign: 'center', marginBottom: 15, color: '#666'}}>{selectedDate}</Text>

          
          <ScrollView style={{ maxHeight: 100, marginBottom: 10 }}>
            {deadlineList
              .filter(item => item.date === selectedDate) // 이 날짜거만 골라내기
              .map((item, index) => (
                <View key={index} style={styles.existingItem}>
                  <Text style={styles.existingItemText}> {item.title}</Text>
                  <Text style={styles.existingItemTime}>{item.time}</Text>
                </View>
            ))}
          </ScrollView>

          <TextInput
            placeholder="할 일 입력"
            placeholderTextColor="#888"
            style={styles.input}
            value={deadlineTitle}
            onChangeText={setDeadlineTitle}
          />

          <TextInput
            placeholder="시간 (예: 18:00)"
            placeholderTextColor="#888"
            style={styles.input}
            value={deadlineTime}
            onChangeText={setDeadlineTime}
          />

          <View style={styles.buttonContainer}>
            <View style={styles.buttonWrapper}>
              <Button
                title="저장"
                onPress={async () => {
                  await addDeadline(selectedDate, deadlineTitle, deadlineTime);
                  setDeadlineModalVisible(false); 
                  setDeadlineTitle("");
                  setDeadlineTime("18:00");
                }}
              />
            </View>
            <View style={styles.buttonWrapper}>
              <Button 
                title="닫기" 
                color="red" 
                onPress={() => setDeadlineModalVisible(false)} 
              />
            </View>
          </View>

        </View>
      </View>
    )}
    </>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f9f9f9' },
    title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginVertical: 20 },
    calendar: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, marginHorizontal: 10, elevation: 2 },
    infoContainer: { padding: 20 },
    infoBox: { backgroundColor: '#fff', borderRadius: 8, padding: 20, marginBottom: 20, elevation: 2 },
    infoTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
    infoContent: { fontSize: 24, fontWeight: 'bold', color: '#FF8F00', textAlign: 'center' },
    chartContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 10, justifyContent: 'center' },
    legendContainer: { flex: 1, marginLeft: 20 },
    legendItem: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
    legendColor: { width: 14, height: 14, borderRadius: 7, marginRight: 8 },
    legendText: { fontSize: 14, flexShrink: 1 },
    noDataText: { textAlign: 'center', color: '#888', marginTop: 20 },
    //마감일관련 추가
    modalOverlay: {
    position: 'absolute', 
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', 
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000, //
  },
  modalContent: {
    width: '85%',
    backgroundColor: 'white',
    padding: 25,
    borderRadius: 15, 
    elevation: 10,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9', 
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between', 
    marginTop: 10,
  },
  buttonWrapper: {
    width: '48%',
  },
  existingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  existingItemText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  existingItemTime: {
    fontSize: 14,
    color: '#FF8F00',
    fontWeight: 'bold',
    marginLeft: 10,
  },
    assignmentsContainer: {
            marginHorizontal: 10,
            marginTop: 20,
            padding: 20,
            backgroundColor: '#fff',
            borderRadius: 8,
            elevation: 2,
        },
        assignmentsTitle: {
            fontSize: 18,
            fontWeight: 'bold',
            marginBottom: 10,
            borderBottomWidth: 1,
            borderBottomColor: '#eee',
            paddingBottom: 10,
        },
        groupScheduleLabel: {
            fontSize: 14,
            fontWeight: 'normal',
            color: '#0D47A1', // 파란색 계열로 구분
        },
        assignmentItem: {
            paddingVertical: 8,
        },
        assignmentTitle: {
            fontSize: 16,
            fontWeight: '600',
        },
        assignmentDesc: {
            fontSize: 14,
            color: '#666',
            marginTop: 4,
        },
        noAssignmentText: {
            textAlign: 'center',
            color: '#888',
            marginVertical: 10,
        },
        addButton: {
            backgroundColor: '#FF8F00',
            borderRadius: 20,
            paddingVertical: 10,
            paddingHorizontal: 15,
            alignSelf: 'center',
            marginTop: 15,
        },
        addButtonText: {
            color: '#fff',
            fontWeight: 'bold',
            fontSize: 16,
        },
        modalContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
        },
        multilineInput: {
            height: 100,
            textAlignVertical: 'top',
        },
        modalButtons: {
            flexDirection: 'row',
            justifyContent: 'space-around',
            marginTop: 10,
        },
});

export default StudyCalendar;