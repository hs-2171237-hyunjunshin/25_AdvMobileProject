import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

export const addDeadline = async (dateString: string, title: string, time: string) => {
  const user = auth().currentUser;
  if (!user) return;

  return firestore()
    .collection('deadlines')
    .add({
      userId: user.uid,
      date: dateString,
      title,
      time,
      createdAt: new Date(),
    });
};

export const getDeadlinesByMonth = async (year: number, month: number) => {
  const user = auth().currentUser;
  if (!user) return [];

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59);

  const snapshot = await firestore()
    .collection('deadlines')
    .where('userId', '==', user.uid)
    .where('createdAt', '>=', start)
    .where('createdAt', '<=', end)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
};
