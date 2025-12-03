const prisma = require('../lib/prisma');

class MeetingFile {
  /**
   * Create a new meeting file record
   */
  static async create({
    meetingId,
    userId,
    filename,
    filepath,
    fileSize,
    mimeType,
    fileType,
    uploaderName
  }) {
    const file = await prisma.meetingFile.create({
      data: {
        meetingId,
        userId,
        filename,
        filepath,
        fileSize: BigInt(fileSize),
        mimeType,
        fileType,
        uploaderName
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePictureUrl: true
          }
        },
        meeting: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    return this._toDTO(file);
  }

  /**
   * Get all files for a meeting
   */
  static async findByMeetingId(meetingId) {
    const files = await prisma.meetingFile.findMany({
      where: { meetingId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePictureUrl: true
          }
        }
      }
    });

    return files.map(this._toDTO);
  }

  /**
   * Get a single file by ID
   */
  static async findById(id) {
    const file = await prisma.meetingFile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePictureUrl: true
          }
        },
        meeting: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    return file ? this._toDTO(file) : null;
  }

  /**
   * Delete a file record (and optionally the physical file)
   */
  static async delete(id) {
    await prisma.meetingFile.delete({
      where: { id }
    });
  }

  /**
   * Convert DB entity to DTO
   */
  static _toDTO(file) {
    return {
      id: file.id,
      meetingId: file.meetingId,
      filename: file.filename,
      filepath: file.filepath,
      fileSize: Number(file.fileSize), // Convert BigInt to Number
      mimeType: file.mimeType,
      fileType: file.fileType,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
      uploadedBy: {
        id: file.user?.id,
        name: file.uploaderName || file.user?.name || file.user?.email || 'Unknown'
      }
    };
  }
}

module.exports = MeetingFile;

