package com.gamedesignerjoe.journalmod.block;

import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.World;

public class TestBlockInteract extends Block {

    public TestBlockInteract(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult onUse(BlockState state, World world, BlockPos pos, PlayerEntity player, BlockHitResult hit) { // The "Hand hand" parameter is removed
        // Only run on the logical server to prevent messages from appearing twice
        if (!world.isClient) {
            // Send a message to the player's chat
            player.sendMessage(Text.of("Hello World"), false);
        }

        // Return SUCCESS to indicate that our action was successful and to prevent
        // the item in the player's hand from being used.
        return ActionResult.SUCCESS;
    }
}