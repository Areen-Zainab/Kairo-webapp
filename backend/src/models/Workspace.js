const prisma = require('../lib/prisma');

class Workspace {
  static async create(userData) {
    const { name, description, ownerId } = userData;

    // Generate unique workspace code
    const generateCode = (workspaceName) => {
      const prefix = workspaceName
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase();
      const randomNum = Math.floor(Math.random() * 10000);
      return `${prefix}-${randomNum}`;
    };

    let code = generateCode(name);
    
    // Ensure code is unique
    let exists = await prisma.workspace.findUnique({ where: { code } });
    while (exists) {
      code = generateCode(name);
      exists = await prisma.workspace.findUnique({ where: { code } });
    }

    // Create workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        code,
        ownerId,
      }
    });

    // Add owner as workspace member
    await prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: ownerId,
        role: 'owner',
      }
    });

    return workspace;
  }

  static async findByOwner(ownerId) {
    return await prisma.workspace.findMany({
      where: {
        ownerId,
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  static async findByMember(userId) {
    const memberships = await prisma.workspaceMember.findMany({
      where: {
        userId,
        isActive: true
      },
      include: {
        workspace: true
      },
      orderBy: {
        workspace: {
          createdAt: 'desc'
        }
      }
    });

    return memberships.map(m => m.workspace);
  }

  static async findByCode(code) {
    return await prisma.workspace.findUnique({
      where: { code }
    });
  }

  static async findById(id) {
    return await prisma.workspace.findUnique({
      where: { id },
      include: {
        owner: true,
        members: {
          include: {
            user: true
          }
        }
      }
    });
  }

  static async update(id, updateData) {
    const allowedFields = ['name', 'description', 'isActive'];
    const filteredData = Object.keys(updateData)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updateData[key];
        return obj;
      }, {});

    return await prisma.workspace.update({
      where: { id },
      data: filteredData
    });
  }

  static async delete(id) {
    return await prisma.workspace.update({
      where: { id },
      data: { isActive: false }
    });
  }

  static async addMember(workspaceId, userId, role = 'member', invitedBy = null) {
    return await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId,
        role,
        invitedBy
      }
    });
  }

  static async removeMember(workspaceId, userId) {
    return await prisma.workspaceMember.update({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId
        }
      },
      data: { isActive: false }
    });
  }

  static async updateMemberRole(workspaceId, userId, role) {
    return await prisma.workspaceMember.update({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId
        }
      },
      data: { role }
    });
  }
}

module.exports = Workspace;

