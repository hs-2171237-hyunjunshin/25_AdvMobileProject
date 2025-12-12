import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

// 임시 데이터
const sampleNotifications = [
  { id: '1', title: '새로운 랭킹 시즌 시작!', content: '이번 주도 열심히 달려보세요! 랭킹이 초기화되었습니다.', date: '어제' },
  { id: '2', title: '서버 점검 안내', content: '오늘 새벽 2시부터 3시까지 서비스가 중단됩니다.', date: '3일 전' },
  { id: '3', title: '환영합니다!', content: 'StudyMate에 오신 것을 환영합니다. 지금 바로 스터디를 시작해보세요.', date: '1주 전' },
];

const Notifications: React.FC = () => {

  const renderNotificationItem = ({ item }: { item: typeof sampleNotifications[0] }) => (
    <View style={styles.notificationItem}>
      <MaterialIcons name="notifications" size={24} color="#FF8F00" style={styles.icon} />
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text style={styles.notificationTitle}>{item.title}</Text>
          <Text style={styles.notificationDate}>{item.date}</Text>
        </View>
        <Text style={styles.notificationBody}>{item.content}</Text>
      </View>
    </View>
  );

  return (
    <FlatList
      data={sampleNotifications}
      renderItem={renderNotificationItem}
      keyExtractor={item => item.id}
      style={styles.container}
      ListHeaderComponent={<Text style={styles.headerTitle}>알림</Text>}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  icon: {
    marginRight: 15,
    marginTop: 2,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  notificationDate: {
    fontSize: 12,
    color: '#999',
  },
  notificationBody: {
    fontSize: 14,
    color: '#666',
  },
});

export default Notifications;
