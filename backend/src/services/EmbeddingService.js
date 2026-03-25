const { pipeline } = require('@xenova/transformers');

class EmbeddingService {
  constructor() {
    this.modelName = 'Xenova/all-MiniLM-L6-v2';
    this.pipelinePromise = null;
  }

  /**
   * Initializes the Transformers.js pipeline lazily.
   * This downloads the model (~22MB) on the first run and caches it.
   */
  async getPipeline() {
    if (!this.pipelinePromise) {
      console.log(`[EmbeddingService] Initializing local embedding model: ${this.modelName}`);
      // Lazy load to avoid blocking startup
      this.pipelinePromise = pipeline('feature-extraction', this.modelName, {
        quantized: true, // Use int8 quantization for speed/smaller memory footprint
      });
    }
    return this.pipelinePromise;
  }

  /**
   * Generates a 384-dimensional vector embedding for a single text string using Transformers.js.
   * @param {string} text - The text to embed
   * @returns {number[]} - The embedding vector array (length 384)
   */
  async generateEmbedding(text) {
    if (!text || text.trim() === '') {
      throw new Error('Input text cannot be empty');
    }
    
    try {
      const extractor = await this.getPipeline();
      const cleaned = text.replace(/\s+/g, ' ').trim();
      
      // Output is a Tensor. pooling='mean' and normalize=true are standard for sentence-transformers
      const output = await extractor(cleaned, { pooling: 'mean', normalize: true });
      
      // Convert Float32Array to standard JS Array
      return Array.from(output.data);
    } catch (error) {
      console.error('Error in EmbeddingService.generateEmbedding:', error);
      throw error;
    }
  }

  /**
   * Generates embeddings for an array of strings in a single batch.
   * @param {string[]} texts - Array of texts to embed
   * @returns {number[][]} - Array of embedding vector arrays (each length 384)
   */
  async generateBatchEmbeddings(texts) {
    if (!Array.isArray(texts) || texts.length === 0) {
      return [];
    }

    try {
      const extractor = await this.getPipeline();
      
      // Clean up whitespace
      const validTexts = texts.map(t => 
        (typeof t === 'string' ? t.replace(/\s+/g, ' ').trim() : '') || ' '
      );

      // Transformers.js feature-extraction accepts arrays of strings for batching
      const output = await extractor(validTexts, { pooling: 'mean', normalize: true });
      
      // We need to reshape the flat data array into an array of arrays.
      // output.dims should be [batch_size, embedding_dim] (e.g., [N, 384])
      const [batchSize, dim] = output.dims;
      const results = [];
      const flatData = output.data;

      for (let i = 0; i < batchSize; i++) {
        // Slice out the 384 dimensions for each input text
        const start = i * dim;
        const end = start + dim;
        results.push(Array.from(flatData.slice(start, end)));
      }

      return results;
    } catch (error) {
      console.error('Error in EmbeddingService.generateBatchEmbeddings:', error);
      throw error;
    }
  }
}

module.exports = new EmbeddingService();
