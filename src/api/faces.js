import { offlineFaceService } from '../db/offlineServices';
import { extractFaceFromFile } from '../utils/faceEmbeddingHelper';
import client from './client';

export const facesApi = {
  getUsers: async () => {
    const response = await client.get('/api/faces/users');
    return response.data;
  },

  getModelStatus: async () => {
    const response = await client.get('/api/model-status');
    return response.data;
  },

  registerUser: async (formData) => {
    const name = formData.get('name');
    const info = formData.get('info') || '';
    const imgFile = formData.get('img');

    if (!imgFile) {
      throw { response: { data: { error: 'Please provide a photo.' } } };
    }

    const { faceEmbedding, imgUrl } = await extractFaceFromFile(imgFile);
    const user = await offlineFaceService.uploadFace({ name, faceEmbedding, imgUrl, info });
    return {
      message: 'Face registered successfully.',
      user: { ...user, _id: user.id },
    };
  },

  updateUser: async (userId, formData) => {
    const name = formData.get('name');
    const info = formData.get('info') || '';
    const imgFile = formData.get('img');

    const updateData = { name, info };
    if (imgFile && imgFile.size > 0) {
      const { faceEmbedding, imgUrl } = await extractFaceFromFile(imgFile);
      updateData.faceEmbedding = faceEmbedding;
      updateData.imgUrl = imgUrl;
    }

    const user = await offlineFaceService.updateUser(userId, updateData);
    return {
      message: 'User updated successfully.',
      user: { ...user, _id: user.id || userId },
    };
  },

  deleteUser: async (userId) => {
    await offlineFaceService.deleteUser(userId);
    return { message: 'User deleted successfully.' };
  },
};
