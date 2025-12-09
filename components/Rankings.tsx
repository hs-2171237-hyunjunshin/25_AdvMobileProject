import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

interface RankingData {
  id: string; // userId
  rank: number;
  // email을 직접 저장하는 것은 보안상 좋지 않으므로, 닉네임 등을 사용해야 함
  // 여기서는 예시로 email 앞부분만 사용
  displayName: string; 
  totalStudyTime: string; // "HH시간 MM분" 형식
}

const Rankings: React.FC = () => {
  const [rankings, setRankings] = useState<RankingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState<RankingData | null>(null);

  useEffect(() => {
    fetchRankings();
  }, []);

  const fetchRankings = async () => {
    setLoading(true);
    try {
      // 1. 모든 사용자의 공부 기록 가져오기
      const sessionsSnapshot = await firestore().collection('study_sessions').get();

      // 2. 사용자별로 총 공부 시간 집계 (userId -> totalSeconds)
      const userStudyData: { [userId: string]: number } = {};
      sessionsSnapshot.forEach(doc => {
        const { userId, durationInSeconds } = doc.data();
        if (!userStudyData[userId]) {
          userStudyData[userId] = 0;
        }
        userStudyData[userId] += durationInSeconds;
      });

      // 3. 총 공부 시간을 기준으로 내림차순 정렬
      const sortedUsers = Object.entries(userStudyData).sort(([, a], [, b]) => b - a);

      // 4. 랭킹 데이터 객체로 변환
      const rankingData: RankingData[] = sortedUsers.map(([userId, totalSeconds], index) => {
        // 간단한 닉네임 생성 (예: 'user...1234')
        // 실제로는 users 컬렉션에서 닉네임을 가져와야 함
        const displayName = `User...${userId.substring(userId.length - 4)}`;
        
        return {
          id: userId,
          rank: index + 1,
          displayName,
          totalStudyTime: formatSeconds(totalSeconds),
        };
      });

      setRankings(rankingData);

      // 5. 내 순위 찾기
      const currentUser = auth().currentUser;
      if (currentUser) {
        const myRankingData = rankingData.find(r => r.id === currentUser.uid);
        setMyRank(myRankingData || null);
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
            <Text style={[styles.rank, myRank.rank <= 3 && styles.topRank]}>{myRank.rank}</Text>
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
  },
  myRankTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    padding: 15,
    backgroundColor: '#f9f9f9',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  myItem: {
    backgroundColor: '#FFF3E0', // 하이라이트 색상
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
  },
  time: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default Rankings;