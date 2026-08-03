import { Request, Response } from 'express';
import { TeamMember } from './team.model';
import cloudinary from '../../config/cloudinary';

// GET ALL TEAM MEMBERS (Public - only active)
export const getAllTeamMembers = async (req: Request, res: Response) => {
  try {
    const filter = { isActive: true };
    const team = await TeamMember.find(filter).sort({ order: 1, createdAt: -1 });
    res.status(200).json(team);
  } catch (_error: any) {
    res.status(500).json({ message: 'Failed to fetch team members' });
  }
};

// GET ALL TEAM MEMBERS (Admin - all members)
export const getAllTeamMembersAdmin = async (req: Request, res: Response) => {
  try {
    const team = await TeamMember.find().sort({ order: 1, createdAt: -1 });
    res.status(200).json(team);
  } catch (_error: any) {
    res.status(500).json({ message: 'Failed to fetch team members' });
  }
};

// GET TEAM MEMBER BY ID (Public/Admin)
export const getTeamMemberById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const teamMember = await TeamMember.findById(id);
    if (!teamMember) return res.status(404).json({ message: 'Team member not found' });
    res.status(200).json(teamMember);
  } catch (_error: any) {
    res.status(500).json({ message: 'Failed to fetch team member' });
  }
};

// CREATE TEAM MEMBER (Admin)
export const createTeamMember = async (req: Request, res: Response) => {
  try {
    let photoData;
    if (req.file) {
      photoData = { url: (req.file as any).path, publicId: req.file.filename };
    }

    // Parse department if it's sent as a stringified array or comma-separated
    let departmentArray: string[] = [];
    if (req.body.department) {
      if (typeof req.body.department === 'string') {
        try {
          departmentArray = JSON.parse(req.body.department);
        } catch (_error: any) {
          departmentArray = req.body.department.split(',').map((d: string) => d.trim());
        }
      } else if (Array.isArray(req.body.department)) {
        departmentArray = req.body.department;
      }
    }

    // Whitelist allowed fields — never spread req.body directly into Mongoose models
    const { name, designation, bio, phone, email, linkedIn, instagram, twitter, order, isActive } =
      req.body;

    const teamMember = new TeamMember({
      name,
      designation,
      bio,
      phone,
      email,
      linkedIn,
      instagram,
      twitter,
      order: order ? Number(order) : undefined,
      isActive: isActive !== undefined ? isActive === 'true' || isActive === true : true,
      department: departmentArray,
      photo: photoData,
    });

    await teamMember.save();
    res.status(201).json(teamMember);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create team member' });
  }
};

// UPDATE TEAM MEMBER (Admin)
export const updateTeamMember = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const teamMember = await TeamMember.findById(id);
    if (!teamMember) return res.status(404).json({ message: 'Team member not found' });

    let photoData = teamMember.photo;

    // Handle new photo upload
    if (req.file) {
      // Delete old photo from Cloudinary if it exists
      if (teamMember.photo?.publicId) {
        try {
          await cloudinary.uploader.destroy(teamMember.photo.publicId);
        } catch (err) {
          console.error('Failed to delete old image from Cloudinary', err);
        }
      }
      // Upload new photo
      photoData = { url: (req.file as any).path, publicId: req.file.filename };
    }

    let departmentArray = teamMember.department;
    if (req.body.department) {
      if (typeof req.body.department === 'string') {
        try {
          departmentArray = JSON.parse(req.body.department);
        } catch (_error: any) {
          departmentArray = req.body.department.split(',').map((d: string) => d.trim());
        }
      } else if (Array.isArray(req.body.department)) {
        departmentArray = req.body.department;
      }
    }

    // Whitelist allowed fields for update
    const { name, designation, bio, phone, email, linkedIn, instagram, twitter, order, isActive } =
      req.body;

    const updatedMember = await TeamMember.findByIdAndUpdate(
      id,
      {
        ...(name !== undefined && { name }),
        ...(designation !== undefined && { designation }),
        ...(bio !== undefined && { bio }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(linkedIn !== undefined && { linkedIn }),
        ...(instagram !== undefined && { instagram }),
        ...(twitter !== undefined && { twitter }),
        ...(order !== undefined && { order: Number(order) }),
        ...(isActive !== undefined && { isActive: isActive === 'true' || isActive === true }),
        department: departmentArray,
        photo: photoData,
      },
      { new: true },
    );

    res.status(200).json(updatedMember);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update team member' });
  }
};

// DELETE TEAM MEMBER (Admin)
export const deleteTeamMember = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const teamMember = await TeamMember.findById(id);
    if (!teamMember) return res.status(404).json({ message: 'Team member not found' });

    // Delete photo from Cloudinary
    if (teamMember.photo?.publicId) {
      try {
        await cloudinary.uploader.destroy(teamMember.photo.publicId);
      } catch (err) {
        console.error('Failed to delete image from Cloudinary', err);
      }
    }

    await TeamMember.findByIdAndDelete(id);
    res.status(200).json({ message: 'Team member deleted successfully' });
  } catch (_error: any) {
    res.status(500).json({ message: 'Failed to delete team member' });
  }
};
