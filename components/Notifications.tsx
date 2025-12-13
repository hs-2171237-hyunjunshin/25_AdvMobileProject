import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, Alert } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { deleteNotification } from './notification/deadline';

// 임시 데이터
const sampleNotifications = [
  { id: 'sample-1', title: '새로운 랭킹 시즌 시작!', message: '이번 주도 열심히 달려보세요! 랭킹이 초기화되었습니다.', dateString: '어제', type: 'system' },
  { id: 'sample-2', title: '서버 점검 안내', message: '오늘 새벽 2시부터 3시까지 서비스가 중단됩니다.', dateString: '3일 전', type: 'system' },
  { id: 'sample-3', title: '환영합니다!', message: 'StudyMate에 오신 것을 환영합니다. 지금 바로 스터디를 시작해보세요.', dateString: '1주 전', type: 'system' },
];

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  dateString?: string;
  createdAt?: any;
  type?: string;
}

const Notifications: React.FC = () => {
  const [realNotifications, setRealNotifications] = useState<NotificationItem[]>([]);
  
  // 모달 관련 State
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 파이어스토어 실시간 구독 (onSnapshot)
  useEffect(() => {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    const unsubscribe = firestore()
      .collection('notifications')
      .where('userId', '==', currentUser.uid)
      // .orderBy('createdAt', 'desc') // 색인(Index) 설정 필요할 수 있음
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
    if (item.dateString) return item.dateString;
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

  // 아이템 클릭 핸들러 (모달 열기)
  const handlePressItem = (id: string) => {
    setSelectedId(id);
    setModalVisible(true);
  };

  // 삭제 실행 핸들러
  const handleConfirmDelete = async () => {
    if (!selectedId) return;

    // 샘플 데이터는 삭제 못하게 막거나, 그냥 모달만 닫기
    if (selectedId.startsWith('sample-')) {
      Alert.alert("알림", "기본 제공 알림은 삭제할 수 없습니다.");
      setModalVisible(false);
      return;
    }

    try {
      await deleteNotification(selectedId);
      // 성공하면 onSnapshot이 알아서 UI를 갱신해주므로 setRealNotifications 안 해도 됨!
      console.log('삭제 성공');
    } catch (error) {
      console.error('삭제 실패', error);
      Alert.alert("오류", "삭제 중 문제가 발생했습니다.");
    } finally {
      setModalVisible(false);
      setSelectedId(null);
    }
  };

  const mergedData = [...realNotifications, ...sampleNotifications];

  const renderNotificationItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity 
      style={styles.notificationItem} 
      onPress={() => handlePressItem(item.id)} // 터치 시 모달 오픈
      activeOpacity={0.7}
    >
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
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={mergedData}
        renderItem={renderNotificationItem}
        keyExtractor={item => item.id}
        ListHeaderComponent={<Text style={styles.headerTitle}>알림 센터</Text>}
      />

      {/* --- 삭제 확인 모달 --- */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>알림 삭제</Text>
            <Text style={styles.modalText}>이 알림을 삭제하시겠습니까?</Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.btn, styles.btnCancel]} 
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.btnText}>취소</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.btn, styles.btnDelete]} 
                onPress={handleConfirmDelete}
              >
                <Text style={[styles.btnText, { color: 'white' }]}>삭제</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
  
  // 모달 스타일 추가
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: 300,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    elevation: 5,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: '#333' },
  modalText: { marginBottom: 24, color: '#666', fontSize: 15 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  btn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  btnCancel: { backgroundColor: '#f5f5f5' },
  btnDelete: { backgroundColor: '#FF4444' },
  btnText: { fontWeight: '600', fontSize: 14 },
});

export default Notifications;