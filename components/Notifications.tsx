import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

//임시 데이터
const sampleNotifications = [
  { id: 'sample-1', title: '새로운 랭킹 시즌 시작!', message: '이번 주도 열심히 달려보세요! 랭킹이 초기화되었습니다.', dateString: '어제', type: 'system' },
  { id: 'sample-2', title: '서버 점검 안내', message: '오늘 새벽 2시부터 3시까지 서비스가 중단됩니다.', dateString: '3일 전', type: 'system' },
  { id: 'sample-3', title: '환영합니다!', message: 'StudyMate에 오신 것을 환영합니다. 지금 바로 스터디를 시작해보세요.', dateString: '1주 전', type: 'system' },
];


interface NotificationItem {
  id: string;
  title: string;
  message: string;
  dateString?: string; // 임시 데이터용 날짜 글자
  createdAt?: any;     // 파이어베이스용 날짜 객체
  type?: string;
}

const Notifications: React.FC = () => {
  const [realNotifications, setRealNotifications] = useState<NotificationItem[]>([]);

  //파이어스토어에서 내 알림 가져오기
  useEffect(() => {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    const unsubscribe = firestore()
      .collection('notifications')
      .where('userId', '==', currentUser.uid)
      //.orderBy('createdAt', 'desc') // 최신순
      .onSnapshot(snapshot => {
        if (!snapshot) return;
        
        const list = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as NotificationItem[];
        
        setRealNotifications(list);
      }, error => {
        console.log("알림 불러오기 패스 (에러 아님):", error);
      });

    return () => unsubscribe();
  }, []);

  // 날짜 변환 함수
  const getDisplayDate = (item: NotificationItem) => {
    if (item.dateString) return item.dateString; // 임시 데이터는 그대로 출력
    if (item.createdAt) {
      const date = item.createdAt.toDate();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${month}월 ${day}일 ${hours}:${minutes}`;
    }
    return '';
  };

  // 데이터 합치기
  const mergedData = [...realNotifications, ...sampleNotifications];

  const renderNotificationItem = ({ item }: { item: NotificationItem }) => (
    <View style={styles.notificationItem}>
      {/* 아이콘 색상: 마감일 관련은 주황색, 나머지는 회색 */}
      <MaterialIcons 
        name="notifications" 
        size={24} 
        color={item.type === 'deadline_created' ? "#FF8F00" : "#999"} 
        style={styles.icon} 
      />
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text style={styles.notificationTitle}>{item.title}</Text>
          <Text style={styles.notificationDate}>{getDisplayDate(item)}</Text>
        </View>
        <Text style={styles.notificationBody}>{item.message}</Text>
      </View>
    </View>
  );

  return (
    <FlatList
      data={mergedData}
      renderItem={renderNotificationItem}
      keyExtractor={item => item.id}
      style={styles.container}
      ListHeaderComponent={<Text style={styles.headerTitle}>알림 센터</Text>}
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  notificationItem: { flexDirection: 'row', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  icon: { marginRight: 15, marginTop: 2 },
  notificationContent: { flex: 1 },
  notificationHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  notificationTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  notificationDate: { fontSize: 12, color: '#999' },
  notificationBody: { fontSize: 14, color: '#666', lineHeight: 20 },
});

export default Notifications;