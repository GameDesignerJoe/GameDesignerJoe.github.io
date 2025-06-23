package com.gamedesignerjoe.journalmod;

import net.fabricmc.api.ModInitializer;
import net.minecraft.block.AbstractBlock;
import net.minecraft.block.Block;
import net.minecraft.item.BlockItem;
import net.minecraft.item.Item;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.RegistryKeys;
import net.minecraft.util.Identifier;
import net.fabricmc.fabric.api.itemgroup.v1.ItemGroupEvents;
import net.minecraft.item.ItemGroups;

import com.gamedesignerjoe.journalmod.block.TestBlockInteract;

import java.util.function.Function;

public class JournalMod implements ModInitializer {
    public static final String MOD_ID = "journal-mod";
    
    public static final Block TEST_BLOCK = register(
        "test_block",
        Block::new,
        AbstractBlock.Settings.create().strength(2.0f),
        true
    );

    public static final Block TEST_BLOCK_INTERACT = register(
        "test_block_interact",
        TestBlockInteract::new, // Use our new custom block class
        AbstractBlock.Settings.create().strength(2.0f),
        true
    );
    
    private static Block register(String name, Function<AbstractBlock.Settings, Block> blockFactory, AbstractBlock.Settings settings, boolean shouldRegisterItem) {
        RegistryKey<Block> blockKey = RegistryKey.of(RegistryKeys.BLOCK, Identifier.of(MOD_ID, name));
        Block block = blockFactory.apply(settings.registryKey(blockKey));
        
        if (shouldRegisterItem) {
            RegistryKey<Item> itemKey = RegistryKey.of(RegistryKeys.ITEM, Identifier.of(MOD_ID, name));
            BlockItem blockItem = new BlockItem(block, new Item.Settings().registryKey(itemKey));
            Registry.register(Registries.ITEM, itemKey, blockItem);
        }
        
        return Registry.register(Registries.BLOCK, blockKey, block);
    }
    
    @Override
    public void onInitialize() {
        System.out.println("Journal Mod initialized!");

        ItemGroupEvents.modifyEntriesEvent(ItemGroups.BUILDING_BLOCKS).register(content -> {
            content.add(TEST_BLOCK);
            content.add(TEST_BLOCK_INTERACT);
        });
    }
}