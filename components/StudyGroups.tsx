import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

// 임시 데이터
const sampleGroups = [
  { id: '1', name: 'React Native 정복 스터디', members: 5 },
  { id: '2', name: '알고리즘 마스터', members: 8 },
  { id: '3', name: '오전 기상 인증 그룹', members: 12 },
  { id: '4', name: 'Firebase 전문가 그룹', members: 4 },
];

const StudyGroups: React.FC = () => {

  const renderGroupItem = ({ item }: { item: typeof sampleGroups[0] }) => (
    <View style={styles.groupItem}>
      <View style={styles.groupIcon}>
        <MaterialIcons name="groups" size={24} color="#FF8F00" />
      </View>
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{item.name}</Text>
        <Text style={styles.groupMembers}>멤버: {item.members}명</Text>
      </View>
      <MaterialIcons name="chevron-right" size={24} color="#ccc" />
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={sampleGroups}
        renderItem={renderGroupItem}
        keyExtractor={item => item.id}
        ListHeaderComponent={
          <Text style={styles.headerTitle}>스터디 그룹</Text>
        }
        ListFooterComponent={
            <TouchableOpacity style={styles.createGroupButton}>
                <Text style={styles.createGroupButtonText}>새 그룹 만들기</Text>
            </TouchableOpacity>
        }
      />
    </View>
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
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
  },
  groupMembers: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  createGroupButton: {
    backgroundColor: '#FF8F00',
    margin: 20,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  createGroupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default StudyGroups;
