import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import type { DateData, MarkedDates } from 'react-native-calendars/src/types';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

// react-native-calendars 한글 설정
LocaleConfig.locales['ko'] = {
  monthNames: [
    '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'
  ],
  monthNamesShort: ['1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.', '10.', '11.', '12.'],
  dayNames: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
  dayNamesShort: ['일', '월', '화', '수', '목', '금', '토'],
  today: '오늘'
};
LocaleConfig.defaultLocale = 'ko';

interface StudySession {
  date: string;
  totalDuration: number; // 분 단위
}

const StudyCalendar: React.FC = () => {
  const [markedDates, setMarkedDates] = useState<MarkedDates>({});
  const [selectedDate, setSelectedDate] = useState('');
  const [dailyStudyTime, setDailyStudyTime] = useState(0);

  useEffect(() => {
    // 컴포넌트 마운트 시 이번 달 공부 기록을 가져옵니다.
    fetchStudySessions(new Date());
  }, []);

  // Firestore에서 공부 기록을 가져오는 함수
  const fetchStudySessions = async (date: Date) => {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    try {
      const querySnapshot = await firestore()
        .collection('study_sessions')
        .where('userId', '==', currentUser.uid)
        .where('completedAt', '>=', startOfMonth)
        .where('completedAt', '<=', endOfMonth)
        .get();

      // 날짜별로 공부 시간 집계
      const sessionsByDate: { [key: string]: number } = {};
      querySnapshot.forEach(doc => {
        const data = doc.data();
        if (data.completedAt) {
          const dateString = data.completedAt.toDate().toISOString().split('T')[0];
          if (!sessionsByDate[dateString]) {
            sessionsByDate[dateString] = 0;
          }
          sessionsByDate[dateString] += data.durationInSeconds;
        }
      });

      // 달력에 표시할 markedDates 객체 생성
      const newMarkedDates: MarkedDates = {};
      for (const date in sessionsByDate) {
        newMarkedDates[date] = { marked: true, dotColor: '#FF8F00' };
      }
      setMarkedDates(newMarkedDates);

    } catch (error) {
      console.error("공부 기록 로딩 실패:", error);
      Alert.alert('오류', '공부 기록을 불러오는 데 실패했습니다.');
    }
  };

  // 날짜 선택 시 실행될 함수
  const handleDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
    // 선택된 날짜의 공부 시간을 계산하여 표시 (여기서는 간단히 예시)
    // 실제로는 fetch한 데이터에서 해당 날짜의 시간을 찾아야 합니다.
  };

  // 달력이 변경될 때 실행될 함수
  const handleMonthChange = (date: DateData) => {
    fetchStudySessions(new Date(date.timestamp));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>스터디 캘린더</Text>
      <Calendar
        style={styles.calendar}
        markedDates={markedDates}
        onDayPress={handleDayPress}
        onMonthChange={handleMonthChange}
        theme={{
          selectedDayBackgroundColor: '#FF8F00',
          arrowColor: '#FF8F00',
          todayTextColor: '#FF8F00',
        }}
      />
      {selectedDate ? (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            {selectedDate}의 공부 기록은 향후 추가될 예정입니다.
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
    color: '#333',
  },
  calendar: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    marginHorizontal: 10,
  },
  infoBox: {
    marginTop: 20,
    marginHorizontal: 20,
    padding: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  infoText: {
    fontSize: 16,
    textAlign: 'center',
  },
});

export default StudyCalendar;
