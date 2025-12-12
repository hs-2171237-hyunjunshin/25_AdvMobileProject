import React, { useState, useCallback } from 'react'; // useEffect 대신 useCallback 임포트
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native'; // useFocusEffect 임포트
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

interface RankingData {
  id: string; // userId
  rank: number;
  displayName: string;
  totalStudyTime: string; // "HH시간 MM분" 형식
}

const Rankings: React.FC = () => {
  const [rankings, setRankings] = useState<RankingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState<RankingData | null>(null);

  // [수정] useEffect를 useFocusEffect로 변경
  useFocusEffect(
    useCallback(() => {
      console.log('랭킹 화면 포커스됨. 데이터 새로고침 시작.');
      fetchRankings();

      // 클린업 함수
      return () => {
        console.log('랭킹 화면 포커스 잃음.');
        // 로딩 상태를 다시 true로 설정하여 다음 포커스 시 로딩 인디케이터를 보여줄 수 있음
        setLoading(true);
      };
    }, [])
  );

  const fetchRankings = async () => {
    setLoading(true);
    try {
      // 1. 모든 사용자의 정보 가져오기 (닉네임 사용을 위해)
      const usersSnapshot = await firestore().collection('users').get();
      const usersData: { [id: string]: { displayName: string } } = {};
      usersSnapshot.forEach(doc => {
        usersData[doc.id] = {
          displayName: doc.data().displayName || `User...${doc.id.substring(doc.id.length - 4)}`,
        };
      });

      // 2. 모든 사용자의 공부 기록 가져오기
      const sessionsSnapshot = await firestore().collection('study_sessions').get();

      // 3. 사용자별로 총 공부 시간 집계 (userId -> totalSeconds)
      const userStudyData: { [userId: string]: number } = {};
      sessionsSnapshot.forEach(doc => {
        const { userId, durationInSeconds } = doc.data();
        if (!userStudyData[userId]) {
          userStudyData[userId] = 0;
        }
        userStudyData[userId] += durationInSeconds;
      });

      // 4. 총 공부 시간을 기준으로 내림차순 정렬
      const sortedUsers = Object.entries(userStudyData).sort(([, a], [, b]) => b - a);

      // 5. 랭킹 데이터 객체로 변환 (users 컬렉션의 displayName 사용)
      const rankingData: RankingData[] = sortedUsers.map(([userId, totalSeconds], index) => {
        return {
          id: userId,
          rank: index + 1,
          displayName: usersData[userId]?.displayName || `알 수 없음`,
          totalStudyTime: formatSeconds(totalSeconds),
        };
      });

      setRankings(rankingData);

      // 6. 내 순위 찾기
      const currentUser = auth().currentUser;
      if (currentUser) {
        const myRankingData = rankingData.find(r => r.id === currentUser.uid);
        if(myRankingData) {
          setMyRank(myRankingData);
        } else {
          // 공부 기록이 없어 랭킹에 없는 경우
          setMyRank({
            id: currentUser.uid,
            rank: 0, // 랭크 없음 표시
            displayName: usersData[currentUser.uid]?.displayName || '나',
            totalStudyTime: '기록 없음'
          });
        }
      }

    } catch (error) {
      console.error("랭킹 데이터 로딩 실패:", error);
      Alert.alert('오류', '랭킹을 불러오는 데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 초를 "HH시간 MM분" 형식으로 변환하는 함수
  const formatSeconds = (seconds: number): string => {
    if (seconds < 60) return "1분 미만";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    }
    return `${minutes}분`;
  };

  // 랭킹 아이템 렌더링 함수
  const renderItem = ({ item, index }: { item: RankingData, index: number }) => (
    <View style={[styles.itemContainer, item.id === auth().currentUser?.uid ? styles.myItem : {}]}>
      <Text style={[styles.rank, index < 3 && styles.topRank]}>{item.rank}</Text>
      <Text style={styles.name}>{item.displayName}</Text>
      <Text style={styles.time}>{item.totalStudyTime}</Text>
    </View>
  );

  if (loading) {
    return <ActivityIndicator size="large" color="#FF8F00" style={styles.loader} />;
  }

  return (
    <View style={styles.container}>
      {myRank && (
        <View style={styles.myRankContainer}>
          <Text style={styles.myRankTitle}>내 순위</Text>
          <View style={[styles.itemContainer, styles.myItem]}>
            <Text style={[styles.rank, myRank.rank > 0 && myRank.rank <= 3 && styles.topRank]}>{myRank.rank > 0 ? myRank.rank : '-'}</Text>
            <Text style={styles.name}>{myRank.displayName}</Text>
            <Text style={styles.time}>{myRank.totalStudyTime}</Text>
          </View>
        </View>
      )}
      <FlatList
        data={rankings}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        ListHeaderComponent={<Text style={styles.listTitle}>전체 랭킹</Text>}
        ListEmptyComponent={<Text style={styles.emptyText}>랭킹 데이터가 없습니다.</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  myRankContainer: {
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#eee',
    elevation: 2,
  },
  myRankTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    padding: 15,
    backgroundColor: '#f9f9f9',
    color: '#333',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  myItem: {
    backgroundColor: '#FFF8E1',
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  rank: {
    fontSize: 18,
    fontWeight: 'bold',
    width: 40,
    color: '#666',
  },
  topRank: {
    color: '#FF8F00',
  },
  name: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  time: {
    fontSize: 16,
    fontWeight: '500',
    color: '#555',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#999',
  },
});

export default Rankings;